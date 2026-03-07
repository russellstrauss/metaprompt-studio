/**
 * apply-template-variants.jsx
 * Adobe Illustrator ExtendScript: applies variant(s) from one JSON to the active template.
 * One JSON file + one .ai template → many JPEG exports (one per variant).
 * Replaces images (by layer name), text (by layer name), and colors (by layer name).
 * Supports raster/placed formats (e.g. JPG, PNG).
 *
 * Usage (stored paths): Set STORED_TEMPLATE_PATH and STORED_JSON_PATH below, then run the script
 * (File → Scripts → Other Script… or double-click). No dialogs; exports and leaves the template open.
 *
 * Usage (interactive): Leave both paths empty. Open your template in Illustrator, run this script,
 * then choose the content JSON in the file dialog.
 *
 * JSON format: { "variants": [ { "outputFileName": "...", "images": {...}, "text": {...}, "colors": {...} }, ... ] }
 * Requires: Named layers in the .ai template matching the keys in each variant.
 */

#target illustrator

// ——— Edit these paths to run with no dialogs (relative to this script’s folder or full paths) ———
// EDIT THESE TWO PATHS (or leave empty to use interactive mode):
var STORED_TEMPLATE_PATH = './fall-football-template.ai';  // e.g. "fall-football-template.ai"
var STORED_JSON_PATH = './fall-football/fall-football-content.json';      // e.g. "fall-football/fall-football-content.json"

(function () {
  'use strict';

  var scriptFile = new File($.fileName);
  var scriptFolder = scriptFile.parent;
  var argsFile = new File(scriptFolder.fullName + '/apply-template-args.txt');
  var batchMode = argsFile.exists;

  function resolvePath(pathStr) {
    if (!pathStr || !String(pathStr).length) return null;
    var p = String(pathStr).replace(/\\/g, '/');
    var fromScript = new File(scriptFolder.fullName + '/' + p);
    if (fromScript.exists) return fromScript;
    var absolute = new File(p);
    if (absolute.exists) return absolute;
    return null;
  }

  var configFile = null;
  var storedPathMode = false;

  if (batchMode) {
    argsFile.open('r');
    argsFile.encoding = 'UTF-8';
    var templatePath = argsFile.readln();
    var jsonPath = argsFile.readln();
    argsFile.close();

    configFile = new File(jsonPath);
    if (!configFile.exists) {
      alert('Batch mode: JSON file not found: ' + jsonPath);
      try { if (argsFile.exists) argsFile.remove(); } catch (e) {}
      app.quit();
      return;
    }
    var templateFileObj = new File(templatePath);
    if (!templateFileObj.exists) {
      alert('Batch mode: Template file not found: ' + templatePath);
      try { if (argsFile.exists) argsFile.remove(); } catch (e) {}
      app.quit();
      return;
    }
    app.open(templateFileObj);
  } else if (STORED_TEMPLATE_PATH && STORED_JSON_PATH) {
    var storedTemplate = resolvePath(STORED_TEMPLATE_PATH);
    var storedJson = resolvePath(STORED_JSON_PATH);
    if (storedTemplate && storedTemplate.exists && storedJson && storedJson.exists) {
      storedPathMode = true;
      configFile = storedJson;
      app.open(storedTemplate);
    } else {
      if (!storedTemplate || !storedTemplate.exists) {
        alert('Stored template path not found: ' + STORED_TEMPLATE_PATH);
      } else {
        alert('Stored JSON path not found: ' + STORED_JSON_PATH);
      }
      return;
    }
  } else {
    if (!app.documents.length) {
      alert('Please open your template document first, or set STORED_TEMPLATE_PATH and STORED_JSON_PATH at the top of this script.');
      return;
    }
    configFile = File.openDialog('Select content JSON (one file, many variants)', '*.json', false);
    if (!configFile) return;
  }

  function quitBatch() {
    try { if (argsFile.exists) argsFile.remove(); } catch (e) {}
    app.quit();
  }

  var jsonStr = readFile(configFile);
  if (!jsonStr) {
    alert('Could not read config file.');
    if (batchMode) quitBatch();
    return;
  }

  var data;
  try {
    data = parseJSON(jsonStr);
  } catch (e) {
    alert('Invalid JSON in config file: ' + (e.message || e.toString()));
    if (batchMode) quitBatch();
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
      if (batchMode) quitBatch();
      return;
    }
  }

  var templateFile = new File(app.activeDocument.fullName);
  var basePath = configFile.parent;

  main();

  if (batchMode) quitBatch();

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

    // Reopen template so user has it open after batch (skip if batch mode; we're quitting)
    if (!batchMode && variants.length > 1) {
      doc.close(SaveOptions.DONOTSAVECHANGES);
      app.open(templateFile);
    }

    if (!batchMode) {
      alert('Exported ' + exportedFiles.length + ' JPEG(s):\n' + exportedFiles.join('\n'));
    }
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

  // Find the first PlacedItem/RasterItem inside a container (layer or group),
  // recursing into nested GroupItems and sublayers so we can correctly handle
  // clipping masks and layer hierarchies like `bg_image` → `image`.
  function findImageItemInContainer(container) {
    if (!container) return null;

    // 1) Search pageItems on this container
    var items = null;
    try {
      items = container.pageItems;
    } catch (e1) {
      items = null;
    }

    if (items && items.length) {
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
    }

    // 2) Also recurse into sublayers, which is how backgrounds like `bg_image`
    // are often structured (layer → sublayer → placed image).
    var layers = null;
    try {
      layers = container.layers;
    } catch (e2) {
      layers = null;
    }

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        var nestedLayerItem = findImageItemInContainer(layers[j]);
        if (nestedLayerItem) return nestedLayerItem;
      }
    }

    return null;
  }

  // Find a "bounding box" PathItem for a logo/mascot layer. Assumes the layer (or
  // its sublayers/groups) contains a rectangle used as the max bounds. For now
  // we simply return the first PathItem we encounter.
  function findBoundsPathInContainer(container) {
    if (!container) return null;

    var items = null;
    try {
      items = container.pageItems;
    } catch (e1) {
      items = null;
    }

    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.typename === 'PathItem') {
          return it;
        }
        if (it.typename === 'GroupItem') {
          var nested = findBoundsPathInContainer(it);
          if (nested) return nested;
        }
      }
    }

    var layers = null;
    try {
      layers = container.layers;
    } catch (e2) {
      layers = null;
    }

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        var nestedLayerPath = findBoundsPathInContainer(layers[j]);
        if (nestedLayerPath) return nestedLayerPath;
      }
    }

    return null;
  }

  // Resize and center a placed image so it fits inside a rectangular bounds
  // while preserving aspect ratio.
  function fitItemIntoBounds(item, boundsPath) {
    if (!item || !boundsPath) return;

    var bb = boundsPath.geometricBounds; // [left, top, right, bottom]
    var boxLeft = bb[0];
    var boxTop = bb[1];
    var boxRight = bb[2];
    var boxBottom = bb[3];
    var boxWidth = boxRight - boxLeft;
    var boxHeight = boxTop - boxBottom;
    if (boxWidth <= 0 || boxHeight <= 0) return;

    var ib = item.geometricBounds;
    var iLeft = ib[0];
    var iTop = ib[1];
    var iRight = ib[2];
    var iBottom = ib[3];
    var iWidth = iRight - iLeft;
    var iHeight = iTop - iBottom;
    if (iWidth <= 0 || iHeight <= 0) return;

    // Use the smaller scale so the image fits inside the box (contain). This
    // keeps aspect ratio; setting only width or only height can distort.
    var scaleW = boxWidth / iWidth;
    var scaleH = boxHeight / iHeight;
    var scale = Math.min(scaleW, scaleH);
    var newWidth = iWidth * scale;
    var newHeight = iHeight * scale;

    try {
      item.width = newWidth;
      item.height = newHeight;
    } catch (e) {}

    // Recompute bounds after scaling
    ib = item.geometricBounds;
    iLeft = ib[0];
    iTop = ib[1];
    iRight = ib[2];
    iBottom = ib[3];
    iWidth = iRight - iLeft;
    iHeight = iTop - iBottom;

    // Center within the bounding box
    var boxCx = (boxLeft + boxRight) / 2;
    var boxCy = (boxTop + boxBottom) / 2;
    var itemCx = (iLeft + iRight) / 2;
    var itemCy = (iTop + iBottom) / 2;

    var dx = boxCx - itemCx;
    var dy = boxCy - itemCy;

    item.left += dx;
    item.top += dy;
  }

  // Recursively find a pageItem by its name within a container (document, layer, or group).
  function findPageItemByNameInContainer(container, name) {
    if (!container) return null;

    var items = null;
    try {
      items = container.pageItems;
    } catch (e1) {
      items = null;
    }

    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        try {
          if (it.name === name) return it;
        } catch (e2) {}

        if (it.typename === 'GroupItem') {
          var nested = findPageItemByNameInContainer(it, name);
          if (nested) return nested;
        }
      }
    }

    var layers = null;
    try {
      layers = container.layers;
    } catch (e3) {
      layers = null;
    }

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        var found = findPageItemByNameInContainer(layers[j], name);
        if (found) return found;
      }
    }

    return null;
  }

  // Recursively set strokeColor on all TextFrames inside a container.
  function setStrokeColorOnTextFrames(container, color) {
    if (!container) return;

    var items = null;
    try {
      items = container.pageItems;
    } catch (e1) {
      items = null;
    }

    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.typename === 'TextFrame') {
          try {
            // Set stroke on the text frame itself
            it.stroked = true;
            it.strokeColor = color;
          } catch (e2) {}

          // Also set stroke via textRange character attributes, which is how
          // Illustrator actually stores text appearance for live type.
          try {
            var tr = it.textRange;
            var ca = tr.characterAttributes;
            ca.strokeColor = color;
            ca.stroked = true;
          } catch (e3) {}
        }
        if (it.typename === 'GroupItem') {
          setStrokeColorOnTextFrames(it, color);
        }
      }
    }

    var layers = null;
    try {
      layers = container.layers;
    } catch (e3) {
      layers = null;
    }

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        setStrokeColorOnTextFrames(layers[j], color);
      }
    }
  }

  // Recursively set strokeColor on all PathItems / CompoundPathItems inside a container.
  function setStrokeColorOnPaths(container, color) {
    if (!container) return;

    var items = null;
    try {
      items = container.pageItems;
    } catch (e1) {
      items = null;
    }

    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.typename === 'PathItem') {
          try {
            it.stroked = true;
            it.strokeColor = color;
          } catch (e2) {}
        } else if (it.typename === 'CompoundPathItem' && it.pathItems && it.pathItems.length) {
          for (var p = 0; p < it.pathItems.length; p++) {
            try {
              it.pathItems[p].stroked = true;
              it.pathItems[p].strokeColor = color;
            } catch (e3) {}
          }
        } else if (it.typename === 'GroupItem') {
          setStrokeColorOnPaths(it, color);
        }
      }
    }

    var layers = null;
    try {
      layers = container.layers;
    } catch (e4) {
      layers = null;
    }

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        setStrokeColorOnPaths(layers[j], color);
      }
    }
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

      // Raster/placed (JPG/PNG/etc). Use recursive search so we correctly handle
      // images inside clipping groups and sublayers (e.g. year_overlay_image masks, bg_image, etc.).
      // For most layers we keep the existing bounds and just swap the file.
      // For school_logo and school_mascot we fit the image into a bounding box while preserving aspect ratio.
      var existing = findImageItemInContainer(layer);
      var item = null;

      if (existing) {
        var parent = existing.parent;
        var left = existing.left;
        var top = existing.top;
        var width = existing.width;
        var height = existing.height;

        if (layerName !== 'school_logo' && layerName !== 'school_mascot') {
          // Generic case: try to reuse the existing placed/raster item so its
          // transform, masks, and effects remain intact.
          try {
            existing.file = file;
            item = existing;
          } catch (eSet) {
            // Fallback: recreate with same bounds in the same parent so any
            // clipping mask/group structure is preserved.
            try {
              existing.remove();
            } catch (eRem) {}
            var repl = doc.placedItems.add();
            repl.file = file;
            repl.left = left;
            repl.top = top;
            if (width && height) {
              repl.width = width;
              repl.height = height;
            }
            repl.move(parent, ElementPlacement.PLACEATEND);
            item = repl;
          }
        } else {
          // Logo/mascot: remove and place a fresh item, then fit into bounding box while preserving aspect ratio.
          try {
            existing.remove();
          } catch (eRem2) {}
          var logoItem = doc.placedItems.add();
          logoItem.file = file;
          logoItem.move(parent, ElementPlacement.PLACEATEND);
          var bbPath = findBoundsPathInContainer(layer);
          if (bbPath) {
            fitItemIntoBounds(logoItem, bbPath);
          }
          item = logoItem;
        }
      } else {
        // No existing image found: place a new one on this layer.
        var placeItem = doc.placedItems.add();
        placeItem.file = file;
        placeItem.left = 0;
        placeItem.top = 0;
        placeItem.move(layer, ElementPlacement.PLACEATEND);
        item = placeItem;

        if (layerName === 'school_logo' || layerName === 'school_mascot') {
          var bbPath2 = findBoundsPathInContainer(layer);
          if (bbPath2) {
            fitItemIntoBounds(item, bbPath2);
          }
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

  // Shrink font size until text fits within the text frame (no overflow).
  // Used for school_title so longer names fit in the bounding box.
  function shrinkTextToFitFrame(textFrame, minSizePt) {
    if (!textFrame || textFrame.typename !== 'TextFrame') return;
    minSizePt = (minSizePt !== undefined && minSizePt > 0) ? minSizePt : 6;
    try {
      var tr = textFrame.textRange;
      var ca = tr.characterAttributes;
      var step = 2; // reduce by 2 pt each iteration for reasonable speed
      while (textFrame.overflows) {
        var currentSize = ca.size;
        if (typeof currentSize !== 'number') currentSize = parseFloat(currentSize) || 12;
        if (currentSize <= minSizePt) break;
        var newSize = Math.max(minSizePt, currentSize - step);
        ca.size = newSize;
      }
    } catch (e) {}
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
          if (layerName === 'school_title') {
            shrinkTextToFitFrame(item, 6);
          }
          break;
        }
      }
    }
  }

  function applyColors(doc, colorMap) {
    var primaryRgb = null;
    var secondaryRgb = null;

    // Resolve primary/secondary from colorMap for template-specific mappings (gradients, masked overlay, etc.).
    if (colorMap.primary_color) {
      var pr = hexToRgb(colorMap.primary_color);
      if (pr) primaryRgb = pr;
    }
    if (colorMap.secondary_color) {
      var sr = hexToRgb(colorMap.secondary_color);
      if (sr) secondaryRgb = sr;
    }

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

    // Template-specific color mappings:
    // 1) masked_overlay_color fill should be primary_color.
    if (primaryRgb) {
      // masked_overlay_color may be a sublayer, group, or single path.
      // Use pageItem name search so this works regardless of hierarchy.
      var maskedItem = findPageItemByNameInContainer(doc, 'masked_overlay_color');
      if (maskedItem) {
        // If it's a group, update its child paths; otherwise update the item itself.
        var targets = [];
        if (maskedItem.typename === 'GroupItem' && maskedItem.pathItems && maskedItem.pathItems.length) {
          for (var gp = 0; gp < maskedItem.pathItems.length; gp++) {
            targets.push(maskedItem.pathItems[gp]);
          }
        } else {
          targets.push(maskedItem);
        }

        for (var ti = 0; ti < targets.length; ti++) {
          var t = targets[ti];
          try {
            if (t.typename === 'PathItem' && t.filled) {
              t.fillColor = primaryRgb;
            } else if (t.typename === 'CompoundPathItem' && t.pathItems && t.pathItems.length) {
              t.pathItems[0].fillColor = primaryRgb;
            }
          } catch (eMask) {}
        }
      }
    }

    // 2) Stroke color of numbers in year_overlay_image should be secondary_color.
    if (secondaryRgb) {
      var yearLayer = getLayerByName(doc, 'year_overlay_image');
      if (yearLayer) {
        setStrokeColorOnTextFrames(yearLayer, secondaryRgb);
        setStrokeColorOnPaths(yearLayer, secondaryRgb);
      }
    }

    // 3) Gradient colors
    // bg_gradient: bottom (start) = primary_color, top (end) = secondary_color.
    if (primaryRgb || secondaryRgb) {
      var bgGradItem = findPageItemByNameInContainer(doc, 'bg_gradient');
      if (bgGradItem && bgGradItem.fillColor && bgGradItem.fillColor.typename === 'GradientColor') {
        var gc = bgGradItem.fillColor;
        var grad = gc.gradient;
        var stops = grad.gradientStops;
        if (stops.length >= 2) {
          if (primaryRgb) {
            stops[0].color = primaryRgb;
          }
          if (secondaryRgb) {
            stops[stops.length - 1].color = secondaryRgb;
          }
        }
        bgGradItem.fillColor = gc;
      }

      // overlay_gradient: top color = primary_color (first stop). Duplicate gradient so the change applies (shared swatches may not update otherwise).
      var overlayGradItem = findPageItemByNameInContainer(doc, 'overlay_gradient');
      if (!overlayGradItem && getLayerByName(doc, 'overlay_gradient')) {
        overlayGradItem = findFirstItemWithGradientFill(getLayerByName(doc, 'overlay_gradient'));
      }
      if (overlayGradItem && primaryRgb) {
        var gradientTarget = getGradientFillTarget(overlayGradItem);
        if (gradientTarget) {
          var newGc = duplicateGradientAndSetFirstStopColor(doc, gradientTarget.fillColor, primaryRgb);
          if (newGc) {
            gradientTarget.item.fillColor = newGc;
          }
        }
      }
    }
  }

  // Duplicate a GradientColor, set the first stop (top of gradient) to the given color, return new GradientColor for assignment.
  // This avoids modifying a shared gradient swatch which may not update the item.
  function duplicateGradientAndSetFirstStopColor(doc, sourceGradientColor, firstStopRgb) {
    if (!doc || !sourceGradientColor || sourceGradientColor.typename !== 'GradientColor' || !firstStopRgb) return null;
    try {
      var srcGrad = sourceGradientColor.gradient;
      var srcStops = srcGrad.gradientStops;
      if (!srcStops || srcStops.length < 1) return null;

      var newGrad = doc.gradients.add();
      newGrad.name = srcGrad.name + ' (variant)';
      newGrad.type = srcGrad.type;

      // Copy stops: set first stop color to firstStopRgb (top), copy others.
      for (var i = 0; i < srcStops.length; i++) {
        var srcStop = srcStops[i];
        var destStop = i < newGrad.gradientStops.length ? newGrad.gradientStops[i] : newGrad.gradientStops.add();
        destStop.rampPoint = srcStop.rampPoint;
        destStop.midPoint = srcStop.midPoint;
        destStop.opacity = srcStop.opacity;
        destStop.color = (i === 0) ? firstStopRgb : srcStop.color;
      }

      var newGc = new GradientColor();
      newGc.gradient = newGrad;
      newGc.angle = sourceGradientColor.angle;
      newGc.length = sourceGradientColor.length;
      if (sourceGradientColor.origin !== undefined) newGc.origin = sourceGradientColor.origin;
      if (sourceGradientColor.hiliteAngle !== undefined) newGc.hiliteAngle = sourceGradientColor.hiliteAngle;
      if (sourceGradientColor.hiliteLength !== undefined) newGc.hiliteLength = sourceGradientColor.hiliteLength;
      return newGc;
    } catch (e) {
      return null;
    }
  }

  // Return the first item (at any depth) in container that has a GradientColor fill.
  function findFirstItemWithGradientFill(container) {
    if (!container) return null;
    var items = null;
    try {
      items = container.pageItems;
    } catch (e) {
      return null;
    }
    if (!items || !items.length) return null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      try {
        if (it.fillColor && it.fillColor.typename === 'GradientColor') return it;
        if (it.typename === 'CompoundPathItem' && it.pathItems && it.pathItems.length && it.pathItems[0].fillColor && it.pathItems[0].fillColor.typename === 'GradientColor') return it;
      } catch (e2) {}
      if (it.typename === 'GroupItem') {
        var nested = findFirstItemWithGradientFill(it);
        if (nested) return nested;
      }
    }
    return null;
  }

  // If item (or its first path in case of CompoundPathItem/GroupItem) has a gradient fill, return { item, fillColor }.
  function getGradientFillTarget(item) {
    if (!item) return null;
    try {
      if (item.fillColor && item.fillColor.typename === 'GradientColor') {
        return { item: item, fillColor: item.fillColor };
      }
      if (item.typename === 'CompoundPathItem' && item.pathItems && item.pathItems.length) {
        var p0 = item.pathItems[0];
        if (p0.fillColor && p0.fillColor.typename === 'GradientColor') {
          return { item: p0, fillColor: p0.fillColor };
        }
      }
      if (item.typename === 'GroupItem' && item.pageItems && item.pageItems.length) {
        for (var j = 0; j < item.pageItems.length; j++) {
          var sub = getGradientFillTarget(item.pageItems[j]);
          if (sub) return sub;
        }
      }
    } catch (e) {}
    return null;
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
