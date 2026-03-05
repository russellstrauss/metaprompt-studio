/**
 * apply-template-variants.jsx
 * Adobe Illustrator ExtendScript: applies variant(s) from one JSON to the active template.
 * One JSON file + one .ai template → many JPEG exports (one per variant).
 * Replaces images (by layer name), text (by layer name), and colors (by layer name).
 * Supports raster/placed formats (e.g. JPG, PNG) and SVG (imported as group via groupItems.createFromFile).
 *
 * Usage: Open your template in Illustrator → File → Scripts → Other Script… → select this
 * file → choose the content JSON. The script exports one JPEG per variant to the same folder as the JSON.
 * JSON format: { "variants": [ { "outputFileName": "...", "images": {...}, "text": {...}, "colors": {...} }, ... ] }
 * Requires: Named layers in the .ai template matching the keys in each variant.
 */

#target illustrator

(function () {
  'use strict';

  if (!app.documents.length) {
    alert('Please open your template document first.');
    return;
  }

  var configFile = File.openDialog('Select content JSON (one file, many variants)', '*.json', false);
  if (!configFile) return;

  var jsonStr = readFile(configFile);
  if (!jsonStr) {
    alert('Could not read config file.');
    return;
  }

  var data;
  try {
    data = parseJSON(jsonStr);
  } catch (e) {
    alert('Invalid JSON in config file: ' + (e.message || e.toString()));
    return;
  }

  /**
   * Parse JSON string. ExtendScript (older Illustrator) may not have JSON.parse.
   * Use native JSON if available, else eval for trusted config file.
   */
  function parseJSON(str) {
    if (typeof JSON !== 'undefined' && typeof JSON.parse === 'function') {
      return JSON.parse(str);
    }
    return eval('(' + str + ')');
  }

  // One template → many instances: expect { "variants": [ {...}, {...} ] }
  // Backward compatibility: if no "variants" array, treat root as single variant
  var variants = data.variants;
  if (!variants || !variants.length) {
    if (data.outputFileName || data.images || data.text || data.colors) {
      variants = [data];
    } else {
      alert('Content JSON must contain a "variants" array or a single variant (outputFileName, images, text, colors).');
      return;
    }
  }

  var templateFile = new File(app.activeDocument.fullName);
  var basePath = configFile.parent;

  main();

  function applyOneVariant(doc, config, basePath) {
    if (config.images && typeof config.images === 'object') {
      applyImages(doc, config.images, basePath);
    }
    if (config.text && typeof config.text === 'object') {
      applyText(doc, config.text);
    }
    if (config.colors && typeof config.colors === 'object') {
      applyColors(doc, config.colors);
    }

    var baseName = (config.outputFileName || doc.name.replace(/\\.ai$/i, '') + ' - variant').replace(/\\.ai$/i, '');
    if (!/\.jpe?g$/i.test(baseName)) baseName += '.jpg';
    var outFile = basePath ? new File(basePath.fullName + '/' + baseName) : new File(baseName);

    var jpegOptions = new ExportOptionsJPEG();
    jpegOptions.qualitySetting = 100;
    jpegOptions.antiAliasing = true;
    jpegOptions.artBoardClipping = true;
    doc.exportFile(outFile, ExportType.JPEG, jpegOptions);
    return outFile;
  }

  function main() {
    var exportedFiles = [];
    var doc = app.activeDocument;

    for (var i = 0; i < variants.length; i++) {
      var config = variants[i];
      var outFile = applyOneVariant(doc, config, basePath);
      exportedFiles.push(outFile.fullName);

      if (i < variants.length - 1) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = app.open(templateFile);
      }
    }

    // Reopen template so user has it open after batch
    if (variants.length > 1) {
      doc.close(SaveOptions.DONOTSAVECHANGES);
      app.open(templateFile);
    }

    alert('Exported ' + exportedFiles.length + ' JPEG(s):\n' + exportedFiles.join('\n'));
  }

  function readFile(file) {
    if (!file.exists) return null;
    file.open('r');
    file.encoding = 'UTF-8';
    var s = file.read();
    file.close();
    return s;
  }

  function findLayerInContainer(container, name) {
    if (!container) return null;

    var layers;
    try {
      layers = container.layers;
    } catch (e) {
      // Some containers in Illustrator can throw when accessing .layers; skip them.
      return null;
    }

    if (!layers || layers.length === 0) return null;

    for (var i = 0; i < layers.length; i++) {
      var layer;
      try {
        layer = layers[i];
      } catch (e2) {
        continue;
      }

      try {
        if (layer.name === name) return layer;
      } catch (e3) {
        // If we cannot read the name for this layer, skip it.
      }

      var found = findLayerInContainer(layer, name);
      if (found) return found;
    }
    return null;
  }

  function getLayerByName(doc, name) {
    return findLayerInContainer(doc, name);
  }

  function isSvgFile(file) {
    var name = file.name ? file.name.toLowerCase() : '';
    return name.length >= 4 && name.indexOf('.svg', name.length - 4) !== -1;
  }

  // Find the first PlacedItem/RasterItem inside a container (layer or group),
  // recursing into nested GroupItems so we can correctly handle clipping masks.
  function findImageItemInContainer(container) {
    if (!container || !container.pageItems) return null;

    var items = container.pageItems;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i];
      if (it.typename === 'PlacedItem' || it.typename === 'RasterItem') {
        return it;
      }
      if (it.typename === 'GroupItem') {
        var nested = findImageItemInContainer(it);
        if (nested) return nested;
      }
    }

    return null;
  }

  function applyImages(doc, images, basePath) {
    for (var layerName in images) {
      if (!images.hasOwnProperty(layerName)) continue;
      var pathOrUrl = images[layerName];
      if (typeof pathOrUrl !== 'string' || !pathOrUrl) continue;

      var layer = getLayerByName(doc, layerName);
      if (!layer) {
        alert('Layer not found: ' + layerName);
        continue;
      }

      var file = resolveFile(pathOrUrl, basePath);
      if (!file || !file.exists) {
        alert('Image file not found for layer "' + layerName + '": ' + pathOrUrl);
        continue;
      }

      if (isSvgFile(file)) {
          // SVG cannot be placed via PlacedItem; createFromFile adds to active layer (which may be locked).
          // Create on a temp unlocked layer, then move to target layer.
          var savedLeft = 0;
          var savedTop = 0;
          var savedWidth = null;
          var savedHeight = null;
          for (var s = 0; s < layer.pageItems.length; s++) {
            var existing = layer.pageItems[s];
            if (existing.typename === 'PlacedItem' || existing.typename === 'RasterItem' || existing.typename === 'GroupItem') {
              savedLeft = existing.left;
              savedTop = existing.top;
              savedWidth = existing.width;
              savedHeight = existing.height;
              existing.remove();
              break;
            }
          }
          var prevActive = doc.activeLayer;
          var tempLayer = doc.layers.add();
          tempLayer.name = "_temp_svg_";
          doc.activeLayer = tempLayer;
          var svgGroup = doc.groupItems.createFromFile(file);
          doc.activeLayer = prevActive;
          svgGroup.move(layer, ElementPlacement.PLACEATEND);
          tempLayer.remove();
          svgGroup.left = savedLeft;
          svgGroup.top = savedTop;
          if (savedWidth != null && savedHeight != null && savedWidth && savedHeight) {
            svgGroup.width = savedWidth;
            svgGroup.height = savedHeight;
          }
        } else {
          // Raster/placed: Find first placed or raster item in this layer,
          // including inside clipping-mask groups, and replace it in-place
          // so the mask/group structure is preserved.
          var existing = findImageItemInContainer(layer);
          var replaced = false;

          if (existing) {
            try {
              existing.file = file;
              replaced = true;
            } catch (e4) {
              var parent = existing.parent;
              var left3 = existing.left;
              var top3 = existing.top;
              var w3 = existing.width;
              var h3 = existing.height;
              existing.remove();

              var newItem2 = doc.placedItems.add();
              newItem2.file = file;
              newItem2.left = left3;
              newItem2.top = top3;
              if (w3 && h3) {
                newItem2.width = w3;
                newItem2.height = h3;
              }
              newItem2.move(parent, ElementPlacement.PLACEATEND);
              replaced = true;
            }
          }

          if (!replaced) {
            var placeItem = doc.placedItems.add();
            placeItem.file = file;
            placeItem.left = 0;
            placeItem.top = 0;
            placeItem.move(layer, ElementPlacement.PLACEATEND);
          }
        }
    }
  }

  function resolveFile(pathOrUrl, basePath) {
    pathOrUrl = String(pathOrUrl || '').replace(/^file:\/\//i, '').replace(/%20/g, ' ');
    var f = new File(pathOrUrl);
    if (f.exists) return f;
    if (basePath && !pathOrUrl.match(/^[a-z]:/i) && pathOrUrl.indexOf('/') !== 0) {
      var combined = new File(basePath.fullName + '/' + pathOrUrl);
      if (combined.exists) return combined;
    }
    return null;
  }

  function applyText(doc, textMap) {
    for (var layerName in textMap) {
      if (!textMap.hasOwnProperty(layerName)) continue;
      var str = textMap[layerName];
      if (typeof str !== 'string') str = String(str);

      var layer = getLayerByName(doc, layerName);
      if (!layer) continue;

      for (var j = 0; j < layer.pageItems.length; j++) {
        var item = layer.pageItems[j];
        if (item.typename === 'TextFrame') {
          item.contents = str;
          break;
        }
      }
    }
  }

  function applyColors(doc, colorMap) {
    for (var layerName in colorMap) {
      if (!colorMap.hasOwnProperty(layerName)) continue;
      var hex = colorMap[layerName];
      if (typeof hex !== 'string') continue;

      var rgb = hexToRgb(hex);
      if (!rgb) continue;

      var layer = getLayerByName(doc, layerName);
      if (!layer) continue;

      for (var k = 0; k < layer.pageItems.length; k++) {
        var item = layer.pageItems[k];
        if (item.pathItems && item.pathItems.length) {
          for (var p = 0; p < item.pathItems.length; p++) {
            item.pathItems[p].fillColor = rgb;
          }
        }
        if (item.typename === 'PathItem' && item.filled) {
          item.fillColor = rgb;
        }
        if (item.typename === 'CompoundPathItem') {
          item.pathItems[0].fillColor = rgb;
        }
      }
    }
  }

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length !== 6 && hex.length !== 8) return null;
    var r = parseInt(hex.substr(0, 2), 16) / 255;
    var g = parseInt(hex.substr(2, 2), 16) / 255;
    var b = parseInt(hex.substr(4, 2), 16) / 255;
    var color = new RGBColor();
    color.red = Math.round(r * 255);
    color.green = Math.round(g * 255);
    color.blue = Math.round(b * 255);
    return color;
  }
})();
