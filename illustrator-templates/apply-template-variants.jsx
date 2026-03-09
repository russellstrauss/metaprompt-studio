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
 * Testing: Set VARIANT_LIMIT (e.g. 20) at the top to process only the first N variants.
 *
 * JSON format: { "variants": [ { "outputFileName": "...", "images": {...}, "text": {...}, "colors": {...} }, ... ] }
 * Requires: Named layers in the .ai template matching the keys in each variant.
 */

#target illustrator

// ——— Edit these paths to run with no dialogs (relative to this script’s folder or full paths) ———
// EDIT THESE TWO PATHS (or leave empty to use interactive mode):
var STORED_TEMPLATE_PATH = './fall-football-template.ai';  // e.g. "fall-football-template.ai"
var STORED_JSON_PATH = './fall-football/fall-football-content.json';      // e.g. "fall-football/fall-football-content.json"
// Limit variants for quick testing (e.g. 20). Set to 0 to process all.
var VARIANT_LIMIT = 0; // Change to 20 to re-enable the testing limit

(function () {
  'use strict';

  // Original school_title text attributes captured once from the template before
  // the variant loop runs. Restored before each variant so shrinkTextToFitFrame
  // always starts from the template's intended size rather than whatever the
  // previous variant left behind.
  var schoolTitleOriginalAttrs = null; // { size, autoLeading, leading }

  var scriptFile = new File($.fileName);
  var scriptFolder = scriptFile.parent;
  var argsFile = new File(scriptFolder.fullName + '/apply-template-args.txt');
  var batchMode = argsFile.exists;
  var errorLogFile = new File(scriptFolder.fullName + '/apply-template-errors.log');

  function logError(message) {
    try {
      var line = '[' + new Date().toString() + '] ' + (message || '') + '\n';
      errorLogFile.open('a');
      errorLogFile.encoding = 'UTF-8';
      errorLogFile.write(line);
      errorLogFile.close();
    } catch (e) {}
  }

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
      logError('Batch mode: JSON file not found: ' + jsonPath);
      try { if (argsFile.exists) argsFile.remove(); } catch (e) {}
      app.quit();
      return;
    }
    var templateFileObj = new File(templatePath);
    if (!templateFileObj.exists) {
      logError('Batch mode: Template file not found: ' + templatePath);
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
        logError('Stored template path not found: ' + STORED_TEMPLATE_PATH);
      } else {
        logError('Stored JSON path not found: ' + STORED_JSON_PATH);
      }
      return;
    }
  } else {
    if (!app.documents.length) {
      logError('Please open your template document first, or set STORED_TEMPLATE_PATH and STORED_JSON_PATH at the top of this script.');
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
    logError('Could not read config file.');
    if (batchMode) quitBatch();
    return;
  }

  var data;
  try {
    data = parseJSON(jsonStr);
  } catch (e) {
    logError('Invalid JSON in config file: ' + (e.message || e.toString()));
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
      logError('Content JSON must contain a "variants" array or a single variant (outputFileName, images, text, colors).');
      if (batchMode) quitBatch();
      return;
    }
  }
  if (typeof VARIANT_LIMIT === 'number' && VARIANT_LIMIT > 0 && variants.length > VARIANT_LIMIT) {
    variants = variants.slice(0, VARIANT_LIMIT);
  }

  var templateFile = new File(app.activeDocument.fullName);
  var basePath = configFile.parent;

  main();

  if (batchMode) quitBatch();

  function applyOneVariant(doc, config, basePath) {
    // Hide and clear the mascot layer when this variant has no mascot image.
    // We remove the placed image entirely (not just hide the layer) so that a
    // leftover image from the previous school never bleeds into this export.
    if (!config.images || !config.images.school_mascot) {
      var mascotLayer = getLayerByName(doc, 'school_mascot');
      if (mascotLayer) {
        try { mascotLayer.visible = false; } catch (eHide) {}
        // Unlock the layer so items inside can be removed.
        try { mascotLayer.locked = false; } catch (eUnlock) {}
        var staleItems = findAllImageItemsInContainer(mascotLayer);
        for (var si = 0; si < staleItems.length; si++) {
          var staleItem = staleItems[si];
          var staleRemoved = false;
          // Try removing the item directly first.
          try { staleItem.remove(); staleRemoved = true; } catch (eRm) {}
          // If that failed the item may be inside a clipping group — try removing the group.
          if (!staleRemoved) {
            var stalePar = null;
            try { stalePar = staleItem.parent; } catch (eParent) {}
            if (stalePar && stalePar.typename === 'GroupItem') {
              try { stalePar.remove(); staleRemoved = true; } catch (eRmGrp) {}
            }
          }
          // Last resort: hide the item individually so it won't appear in the export.
          if (!staleRemoved) {
            try { staleItem.hidden = true; } catch (eHideItem) {}
          }
        }
      }
    } else {
      // Ensure it's visible for variants that do have a distinct mascot.
      var mascotLayerOn = getLayerByName(doc, 'school_mascot');
      if (mascotLayerOn) {
        try { mascotLayerOn.visible = true; } catch (eShow) {}
        try { mascotLayerOn.locked = false; } catch (eUnlock2) {}
      }
    }

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
    var outputDir = basePath ? new Folder(basePath.fullName + '/output') : null;
    if (outputDir && !outputDir.exists) outputDir.create();
    var outFile = outputDir
      ? new File(outputDir.fullName + '/' + baseName)
      : (basePath ? new File(basePath.fullName + '/' + baseName) : new File(baseName));

    var jpegOptions = new ExportOptionsJPEG();
    jpegOptions.qualitySetting = 100;
    jpegOptions.antiAliasing = true;
    jpegOptions.artBoardClipping = true;
    doc.exportFile(outFile, ExportType.JPEG, jpegOptions);
    return outFile;
  }

  function main() {
    var exportedFiles = [];
    // Process all variants on the same in-memory document without closing/reopening.
    // The template's year_overlay_image layer only exists in the unsaved in-memory
    // document — it is absent from the saved .ai file on disk. Closing and reopening
    // loses it, so each variant's changes are applied directly over the previous one.
    // Each call to applyOneVariant overwrites colors, text, and images in-place.
    var doc = app.activeDocument;

    // Build sorted lists of background and year-overlay images to cycle through.
    // Each variant gets a different image; after the last file the list wraps around.
    // bg and overlay counts are independent so they produce a varied combination per variant.
    function buildImageCycleList(folderPath) {
      var files = [];
      var folder = new Folder(folderPath);
      if (!folder.exists) return files;
      var found = folder.getFiles(/\.(jpg|jpeg|png)$/i);
      if (!found || !found.length) return files;
      found.sort(function (a, b) {
        var an = (a instanceof File) ? a.name.toLowerCase() : String(a).toLowerCase();
        var bn = (b instanceof File) ? b.name.toLowerCase() : String(b).toLowerCase();
        return an < bn ? -1 : an > bn ? 1 : 0;
      });
      for (var fi = 0; fi < found.length; fi++) {
        if (found[fi] instanceof File) files.push(found[fi]);
      }
      return files;
    }

    var bgFiles = buildImageCycleList(basePath.fullName + '/images/backgrounds');
    var overlayFiles = buildImageCycleList(basePath.fullName + '/images/year-overlays');

    // Capture original font attributes from the school_title text frame once so we
    // can restore them before every variant. Without this, shrinkTextToFitFrame
    // leaves a reduced font size in the live document, and subsequent variants start
    // from that smaller size instead of the template's intended size.
    schoolTitleOriginalAttrs = null;
    var stlCapture = [];
    collectSchoolTitleLayers(doc, stlCapture);
    outer: for (var si = 0; si < stlCapture.length; si++) {
      var stlLayer = stlCapture[si];
      for (var spi = 0; spi < stlLayer.pageItems.length; spi++) {
        var spItem = stlLayer.pageItems[spi];
        if (spItem.typename === 'TextFrame') {
          try {
            var stlTr = spItem.textRange;
            var stlCa = stlTr.characterAttributes;
            schoolTitleOriginalAttrs = {
              size: stlCa.size,
              autoLeading: stlCa.autoLeading,
              leading: stlCa.autoLeading ? null : stlCa.leading
            };
          } catch (eCap) {}
          break outer;
        }
      }
    }

    for (var i = 0; i < variants.length; i++) {
      var config = variants[i];
      // Override bg_image and year_overlay_image with the next file in each cycle,
      // ignoring whatever the JSON specifies. The two lists have independent lengths
      // so they produce a varied combination for each output photo.
      if (bgFiles.length || overlayFiles.length) {
        if (!config.images) config.images = {};
        if (bgFiles.length) config.images['bg_image'] = bgFiles[i % bgFiles.length].fsName;
        if (overlayFiles.length) config.images['year_overlay_image'] = overlayFiles[i % overlayFiles.length].fsName;
      }
      var outFile = applyOneVariant(doc, config, basePath);
      exportedFiles.push(outFile.fullName);
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

  // Find a named container (layer OR GroupItem) at any nesting depth.
  // Checks container.layers by name, then container.pageItems by name, recursing into both.
  // This handles cases where Illustrator treats a sublayer as a GroupItem on reopen.
  function findContainerByName(container, name) {
    if (!container) return null;
    var layers = null;
    try { layers = container.layers; } catch (e1) {}
    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        try {
          if (layers[j].name === name) return layers[j];
          var r = findContainerByName(layers[j], name);
          if (r) return r;
        } catch (e2) {}
      }
    }
    var items = null;
    try { items = container.pageItems; } catch (e3) {}
    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        try {
          if (items[i].name === name) return items[i];
          if (items[i].typename === 'GroupItem') {
            var r2 = findContainerByName(items[i], name);
            if (r2) return r2;
          }
        } catch (e4) {}
      }
    }
    return null;
  }

  // Collect all layers whose name starts with "school_title" (e.g. school_title, school_title_2, school_title copy).
  function collectSchoolTitleLayers(container, result) {
    if (!container || !result) return;
    var layers;
    try {
      layers = container.layers;
    } catch (e) {
      return;
    }
    if (!layers || layers.length === 0) return;
    for (var i = 0; i < layers.length; i++) {
      try {
        var layer = layers[i];
        if (layer.name && String(layer.name).indexOf('school_title') === 0) {
          result.push(layer);
        }
        collectSchoolTitleLayers(layer, result);
      } catch (e2) {}
    }
  }

  // Find the first PlacedItem/RasterItem inside a container (layer or group),
  // recursing into nested GroupItems and sublayers so we can correctly handle
  // clipping masks and layer hierarchies like `bg_image` → `image`.
  function findImageItemInContainer(container) {
    var all = findAllImageItemsInContainer(container);
    return all.length ? all[0] : null;
  }

  // Find all PlacedItem/RasterItem inside a container (e.g. bg_image with duplicate layers).
  // Same recursion as findImageItemInContainer but collects every image.
  function findAllImageItemsInContainer(container, out) {
    if (!container) return out || [];
    out = out || [];

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
          out.push(it);
        } else if (it.typename === 'GroupItem') {
          findAllImageItemsInContainer(it, out);
        }
      }
    }

    // 2) Also recurse into sublayers
    var layers = null;
    try {
      layers = container.layers;
    } catch (e2) {
      layers = null;
    }

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        findAllImageItemsInContainer(layers[j], out);
      }
    }

    return out;
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

  // Resize and position a placed image so it fits inside a rectangular bounds
  // while preserving aspect ratio. verticalAlign: 'center' (default) or 'bottom'.
  function fitItemIntoBounds(item, boundsPath, verticalAlign) {
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

    // Horizontal: center within the bounding box
    var boxCx = (boxLeft + boxRight) / 2;
    var itemCx = (iLeft + iRight) / 2;
    var dx = boxCx - itemCx;

    // Vertical: center (default) or bottom-align to bounding box
    var dy;
    if (verticalAlign === 'bottom') {
      dy = boxBottom - iBottom;
    } else {
      var boxCy = (boxTop + boxBottom) / 2;
      var itemCy = (iTop + iBottom) / 2;
      dy = boxCy - itemCy;
    }

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
            it.stroked = true;
            it.strokeColor = color;
          } catch (e2) {}

          try {
            var tr = it.textRange;
            var ca = tr.characterAttributes;
            ca.strokeColor = color;
            ca.stroked = true;
          } catch (e3) {}

          try {
            var chars = tr.characters;
            if (chars && chars.length) {
              for (var c = 0; c < chars.length; c++) {
                var charRange = chars[c];
                if (charRange && charRange.characterAttributes) {
                  charRange.characterAttributes.strokeColor = color;
                  charRange.characterAttributes.stroked = true;
                }
              }
            }
          } catch (e4) {}
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
        logError('Layer not found: ' + layerName);
        continue;
      }

      var file = resolveFile(pathOrUrl, basePath);
      if (!file || !file.exists) {
        logError('Image file not found for layer "' + layerName + '": ' + pathOrUrl);
        // For mascot/logo layers, clear the stale image so the previous school's
        // graphic doesn't bleed into this export when the file is missing.
        if (layerName === 'school_mascot' || layerName === 'school_logo') {
          try { layer.visible = false; } catch (eClearVis) {}
          try { layer.locked = false; } catch (eClearLock) {}
          var clearItems = findAllImageItemsInContainer(layer);
          for (var ci = 0; ci < clearItems.length; ci++) {
            try { clearItems[ci].remove(); } catch (eCi) {
              try { clearItems[ci].hidden = true; } catch (eCiH) {}
            }
          }
        }
        continue;
      }
      if (!isValidPlacedImageFile(file)) {
        logError('Image file is not a valid PNG/JPEG (or is corrupt); skipping to avoid plug-in error. Layer: "' + layerName + '", path: ' + pathOrUrl);
        // Same stale-image clearance for corrupt/unreadable files.
        if (layerName === 'school_mascot' || layerName === 'school_logo') {
          try { layer.visible = false; } catch (eClearVis2) {}
          try { layer.locked = false; } catch (eClearLock2) {}
          var clearItems2 = findAllImageItemsInContainer(layer);
          for (var ci2 = 0; ci2 < clearItems2.length; ci2++) {
            try { clearItems2[ci2].remove(); } catch (eCi2) {
              try { clearItems2[ci2].hidden = true; } catch (eCi2H) {}
            }
          }
        }
        continue;
      }

      // Raster/placed (JPG/PNG/etc). Use recursive search so we correctly handle
      // images inside clipping groups and sublayers (e.g. year_overlay_image masks, bg_image, etc.).
      // Prefer relink() when we have an existing PlacedItem (avoids Error 9080 on .file assignment).
      var allExisting = findAllImageItemsInContainer(layer);
      var item = null;

      function placeFileAndPosition(placeItem, parent, left, top, width, height) {
        try {
          placeItem.file = file;
        } catch (e9080) {
          // Do NOT use app.open(file) as fallback: Illustrator shows a blocking dialog
          // ("Could not read the file because the plug-in could not understand this file")
          // for unsupported/corrupt images, which stops the script until user clicks OK.
          placeItem.remove();
          logError('Could not place image (relink/place failed); skipping. Layer: ' + layerName + ', path: ' + (file.fsName || pathOrUrl));
          return null;
        }
        placeItem.move(parent, ElementPlacement.PLACEATEND);
        if (left !== undefined && top !== undefined) {
          placeItem.left = left;
          placeItem.top = top;
        }
        if (width && height) {
          placeItem.width = width;
          placeItem.height = height;
        }
        return placeItem;
      }

      if (layerName !== 'school_logo' && layerName !== 'school_mascot') {
        // Generic case: replace every image in the layer with the new file.
        var relinkedFirst = false;
        for (var idx = 0; idx < allExisting.length; idx++) {
          var existing = allExisting[idx];
          var parent = existing.parent;
          var left = existing.left;
          var top = existing.top;
          var width = existing.width;
          var height = existing.height;
          if (idx === 0 && existing.typename === 'PlacedItem') {
            try {
              existing.relink(file);
              existing.left = left;
              existing.top = top;
              if (width && height) {
                existing.width = width;
                existing.height = height;
              }
              existing.move(parent, ElementPlacement.PLACEATEND);
              item = existing;
              relinkedFirst = true;
            } catch (eRelink) {}
          }
          if (!relinkedFirst || idx > 0) {
            try {
              existing.remove();
            } catch (eRem) {}
            var repl = doc.placedItems.add();
            repl = placeFileAndPosition(repl, parent, left, top, width, height);
            if (repl) item = repl;
          }
        }
      } else if (allExisting.length) {
        // Logo/mascot: one image; relink if PlacedItem, else remove and place.
        var existing = allExisting[0];
        var parent = existing.parent;
        if (existing.typename === 'PlacedItem') {
          try {
            existing.relink(file);
            existing.move(parent, ElementPlacement.PLACEATEND);
            item = existing;
          } catch (eRelink) {
            try {
              existing.remove();
            } catch (eRem2) {}
            var logoItem = doc.placedItems.add();
            item = placeFileAndPosition(logoItem, parent, 0, 0, undefined, undefined);
          }
        } else {
          try {
            existing.remove();
          } catch (eRem2) {}
          var logoItem = doc.placedItems.add();
          item = placeFileAndPosition(logoItem, parent, 0, 0, undefined, undefined);
        }
        var bbPath = findBoundsPathInContainer(layer);
        if (bbPath && item) {
          fitItemIntoBounds(item, bbPath, (layerName === 'school_mascot' || layerName === 'school_logo') ? 'bottom' : undefined);
        }
      }

      if (!allExisting.length) {
        // No existing image: place a new one on this layer.
        var placeItem = doc.placedItems.add();
        var placed = false;
        try {
          placeItem.file = file;
          placed = true;
          item = placeItem;
        } catch (e9080) {
          placeItem.remove();
          // Do NOT use app.open(file) as fallback: Illustrator shows a blocking dialog
          // for unsupported/corrupt images, which stops the script until user clicks OK.
          logError('Could not place image for layer "' + layerName + '". Check that the file is a valid PNG/JPG and the path is not too long. Path: ' + (file.fsName || pathOrUrl));
          continue;
        }
        if (item) {
          if (item === placeItem) {
            placeItem.left = 0;
            placeItem.top = 0;
            placeItem.move(layer, ElementPlacement.PLACEATEND);
          }
        }

        if (item && (layerName === 'school_logo' || layerName === 'school_mascot')) {
          var bbPath2 = findBoundsPathInContainer(layer);
          if (bbPath2) {
            fitItemIntoBounds(item, bbPath2, (layerName === 'school_mascot' || layerName === 'school_logo') ? 'bottom' : undefined);
          }
        }
      }
    }
  }

  /**
   * Return true if the file looks like a valid PNG or JPEG (by header).
   * Use this before place/relink to avoid Illustrator's blocking "plug-in could not understand this file" dialog.
   */
  function isValidPlacedImageFile(file) {
    if (!file || !file.exists) return false;
    try {
      file.open('r');
      file.encoding = 'BINARY';
      var head = file.read(12);
      file.close();
      if (!head || head.length < 8) return false;
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (head.charCodeAt(0) === 0x89 && head.charCodeAt(1) === 0x50 && head.charCodeAt(2) === 0x4E && head.charCodeAt(3) === 0x47) return true;
      // JPEG: FF D8 FF
      if (head.charCodeAt(0) === 0xFF && head.charCodeAt(1) === 0xD8 && head.charCodeAt(2) === 0xFF) return true;
      return false;
    } catch (e) {
      try { file.close(); } catch (e2) {}
      return false;
    }
  }

  function resolveFile(pathOrUrl, basePath) {
    pathOrUrl = String(pathOrUrl || '').replace(/^file:\/\//i, '').replace(/%20/g, ' ');
    var sep = (typeof $.os !== 'undefined' && $.os.indexOf('Windows') !== -1) ? '\\' : '/';
    var pathNormalized = pathOrUrl.replace(/\//g, sep);
    var f = new File(pathOrUrl);
    if (f.exists) return new File(f.fsName);
    if (basePath && !pathOrUrl.match(/^[a-z]:/i) && pathOrUrl.indexOf('/') !== 0 && pathOrUrl.indexOf('\\') !== 0) {
      var baseStr = String(basePath.fullName).replace(/[\/\\]+$/, '');
      var combinedPath = baseStr + sep + pathNormalized;
      var combined = new File(combinedPath);
      if (combined.exists) return new File(combined.fsName);
    }
    return null;
  }

  // True if the text frame has overset/overflowing text.
  function textOverflows(textFrame) {
    if (!textFrame || textFrame.typename !== 'TextFrame') return false;
    try {
      if (textFrame.overflows) return true;
      var tr = textFrame.textRange;
      var totalLen = (tr && tr.length !== undefined) ? tr.length : (textFrame.contents ? textFrame.contents.length : 0);
      if (totalLen === 0) return false;
      var lines = tr && tr.lines;
      if (lines && lines.length) {
        var visible = 0;
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].characters && lines[i].characters.length !== undefined) visible += lines[i].characters.length;
          else visible += (lines[i].length !== undefined) ? lines[i].length : 0;
        }
        return visible < totalLen;
      }
      return !!textFrame.overflows;
    } catch (e) {
      return !!textFrame.overflows;
    }
  }

  // Set text frame to bounds [left, top, right, bottom]. Tries geometricBounds then left/top/width/height.
  function setTextFrameBounds(textFrame, bounds) {
    if (!textFrame || textFrame.typename !== 'TextFrame' || !bounds || bounds.length !== 4) return;
    try {
      textFrame.geometricBounds = bounds;
    } catch (e1) {
      try {
        var width = bounds[2] - bounds[0];
        var height = bounds[3] - bounds[1];
        if (width > 0 && height > 0) {
          textFrame.left = bounds[0];
          textFrame.top = bounds[1];
          textFrame.width = width;
          textFrame.height = height;
        }
      } catch (e2) {}
    }
  }

  // Shrink font size until text fits within the text frame (no overflow).
  // Used for school_title so longer names fit in the bounding box of the type object.
  function shrinkTextToFitFrame(textFrame, minSizePt, doc) {
    if (!textFrame || textFrame.typename !== 'TextFrame') return;
    minSizePt = (minSizePt !== undefined && minSizePt > 0) ? minSizePt : 6;
    var step = 2;
    var maxIterations = 100;
    var iterations = 0;
    try {
      if (doc && typeof doc.redraw === 'function') doc.redraw();
      while (textOverflows(textFrame) && iterations < maxIterations) {
        iterations++;
        var tr = textFrame.textRange;
        var ca = tr.characterAttributes;
        var currentSize = ca.size;
        if (typeof currentSize !== 'number') currentSize = parseFloat(currentSize) || 12;
        if (currentSize <= minSizePt) break;
        var newSize = Math.max(minSizePt, currentSize - step);
        var sizeRatio = newSize / currentSize;

        // Sample leading from the first character so we can scale it proportionally.
        // Only applies when leading is fixed (autoLeading = false); auto-leading
        // adjusts itself automatically as font size changes.
        var sampleAutoLeading = true;
        var sampleLeading = null;
        try {
          var firstChar = tr.characters[0];
          if (firstChar) {
            sampleAutoLeading = firstChar.characterAttributes.autoLeading;
            if (!sampleAutoLeading) sampleLeading = firstChar.characterAttributes.leading;
          }
        } catch (eLead) {}

        var words = tr.words;
        if (words && words.length > 0) {
          for (var w = 0; w < words.length; w++) {
            try {
              words[w].characterAttributes.size = newSize;
              if (!sampleAutoLeading && sampleLeading !== null) {
                words[w].characterAttributes.leading = sampleLeading * sizeRatio;
              }
            } catch (e2) {}
          }
        } else {
          try {
            ca.size = newSize;
            if (!sampleAutoLeading && sampleLeading !== null) {
              ca.leading = sampleLeading * sizeRatio;
            }
          } catch (e2) {}
        }
        if (doc && typeof doc.redraw === 'function') doc.redraw();
      }
    } catch (e) {}
  }

  function applyTextToSchoolTitleLayer(doc, layer, str) {
    if (!layer || !layer.pageItems) return;
    var boundsPath = findBoundsPathInContainer(layer);
    var targetBounds = null;
    if (boundsPath && boundsPath.typename === 'PathItem') {
      targetBounds = boundsPath.geometricBounds;
    }
    for (var j = 0; j < layer.pageItems.length; j++) {
      var item = layer.pageItems[j];
      if (item.typename === 'TextFrame') {
        var bounds = targetBounds && targetBounds.length === 4 ? targetBounds : item.geometricBounds;

        // Restore the template's original font size and leading before setting new
        // content. shrinkTextToFitFrame only ever reduces size, so without this reset
        // each variant inherits whatever reduced size the previous variant left behind.
        if (schoolTitleOriginalAttrs) {
          try {
            var restoreChars = item.textRange.characters;
            for (var rc = 0; rc < restoreChars.length; rc++) {
              try {
                var rca = restoreChars[rc].characterAttributes;
                rca.size = schoolTitleOriginalAttrs.size;
                rca.autoLeading = schoolTitleOriginalAttrs.autoLeading;
                if (!schoolTitleOriginalAttrs.autoLeading && schoolTitleOriginalAttrs.leading !== null) {
                  rca.leading = schoolTitleOriginalAttrs.leading;
                }
              } catch (eRestore) {}
            }
          } catch (eRestoreOuter) {}
        }

        item.contents = str;
        if (bounds && bounds.length === 4) setTextFrameBounds(item, bounds);
        if (doc && typeof doc.redraw === 'function') doc.redraw();
        shrinkTextToFitFrame(item, 6, doc);
      }
    }
  }

  function applyText(doc, textMap) {
    var schoolTitleStr = null;
    if (textMap.hasOwnProperty('school_title')) {
      schoolTitleStr = textMap['school_title'];
      if (typeof schoolTitleStr !== 'string') schoolTitleStr = String(schoolTitleStr);
    }

    for (var layerName in textMap) {
      if (!textMap.hasOwnProperty(layerName)) continue;
      var str = textMap[layerName];
      if (typeof str !== 'string') str = String(str);

      if (layerName === 'school_title' && schoolTitleStr !== null) {
        // Apply school name to school_title and any duplicate layers (e.g. school_title_2, school_title copy).
        var schoolTitleLayers = [];
        collectSchoolTitleLayers(doc, schoolTitleLayers);
        for (var s = 0; s < schoolTitleLayers.length; s++) {
          applyTextToSchoolTitleLayer(doc, schoolTitleLayers[s], schoolTitleStr);
        }
        continue;
      }

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

    // 2) Gradient colors
    // bg_gradient: bottom = primary_color, top = secondary_color.
    // In the template, stop 0 is typically at top (0%) and last stop at bottom (100%); assign accordingly.
    if (primaryRgb || secondaryRgb) {
      var bgGradItem = findPageItemByNameInContainer(doc, 'bg_gradient');
      if (bgGradItem && bgGradItem.fillColor && bgGradItem.fillColor.typename === 'GradientColor') {
        var gc = bgGradItem.fillColor;
        var grad = gc.gradient;
        var stops = grad.gradientStops;
        if (stops.length >= 2) {
          if (secondaryRgb) {
            stops[0].color = secondaryRgb;  // top (first stop)
          }
          if (primaryRgb) {
            stops[stops.length - 1].color = primaryRgb;  // bottom (last stop)
          }
        }
        bgGradItem.fillColor = gc;
      }

      // overlay_gradient: top color = secondary_color (first stop). Duplicate gradient so the change applies (shared swatches may not update otherwise).
      var overlayGradItem = findPageItemByNameInContainer(doc, 'overlay_gradient');
      if (!overlayGradItem && getLayerByName(doc, 'overlay_gradient')) {
        overlayGradItem = findFirstItemWithGradientFill(getLayerByName(doc, 'overlay_gradient'));
      }
      if (overlayGradItem && secondaryRgb) {
        var gradientTarget = getGradientFillTarget(overlayGradItem);
        if (gradientTarget) {
          var newGc = duplicateGradientAndSetFirstStopColor(doc, gradientTarget.fillColor, secondaryRgb);
          if (newGc) {
            gradientTarget.item.fillColor = newGc;
          }
        }
      }
    }

    // 3) Stroke color of numbers in year_overlay_image should be secondary_color.
    if (secondaryRgb) {
      var yearContainer = findContainerByName(doc, 'year_overlay_image');
      if (yearContainer) {
        setStrokeColorOnTextFrames(yearContainer, secondaryRgb);
        setStrokeColorOnPaths(yearContainer, secondaryRgb);
      }
    }

    // 4) If secondary color is white, set "COLLEGE FOOTBALL SEASON" text fill to black.
    if (secondaryRgb && secondaryRgb.red === 255 && secondaryRgb.green === 255 && secondaryRgb.blue === 255) {
      var blackColor = new RGBColor();
      blackColor.red = 0;
      blackColor.green = 0;
      blackColor.blue = 0;
      setFillColorOnMatchingTextFrames(doc, 'COLLEGE FOOTBALL SEASON', blackColor);
    }
  }

  // Recursively find TextFrames whose contents include searchText and set their fill color.
  function setFillColorOnMatchingTextFrames(container, searchText, color) {
    if (!container) return;

    var items = null;
    try { items = container.pageItems; } catch (e1) {}

    if (items && items.length) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.typename === 'TextFrame') {
          try {
            if (String(it.contents).indexOf(searchText) !== -1) {
              var tr = it.textRange;
              var ca = tr.characterAttributes;
              ca.fillColor = color;
              var chars = tr.characters;
              if (chars && chars.length) {
                for (var c = 0; c < chars.length; c++) {
                  try {
                    if (chars[c].characterAttributes) {
                      chars[c].characterAttributes.fillColor = color;
                    }
                  } catch (e2) {}
                }
              }
            }
          } catch (e3) {}
        }
        if (it.typename === 'GroupItem') {
          setFillColorOnMatchingTextFrames(it, searchText, color);
        }
      }
    }

    var layers = null;
    try { layers = container.layers; } catch (e4) {}

    if (layers && layers.length) {
      for (var j = 0; j < layers.length; j++) {
        setFillColorOnMatchingTextFrames(layers[j], searchText, color);
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
