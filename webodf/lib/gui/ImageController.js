/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

var runtime = require("../runtime").runtime;
var Operation = require("../ops/Operation").Operation;
var OdtCursor = require("../ops/OdtCursor").OdtCursor;
var odfUtils = require("../odf/OdfUtils");
var HyperlinkController = require("./HyperlinkController").HyperlinkController;
var CommonConstraints = require("./CommonConstraints").CommonConstraints;
var Session = require("../ops/Session").Session;
var SessionConstraints = require("./SessionConstraints").SessionConstraints;
var SessionContext = require("./SessionContext").SessionContext;
var ObjectNameGenerator = require("../odf/ObjectNameGenerator").ObjectNameGenerator;
var cssUnits = require("../core/CSSUnits");
var OpInsertImage = require("../ops/OpInsertImage").OpInsertImage;
var OpSetBlob = require("../ops/OpSetBlob").OpSetBlob;
var OpAddStyle = require("../ops/OpAddStyle").OpAddStyle;
var EventNotifier = require("../core/EventNotifier").EventNotifier;
var OpsDocument = require("../ops/Document").Document;
var Namespaces = require("../odf/Namespaces").Namespaces;

/**
 * @constructor
 * @param {!Session} session
 * @param {!SessionConstraints} sessionConstraints
 * @param {!SessionContext} sessionContext
 * @param {!string} inputMemberId
 * @param {!ObjectNameGenerator} objectNameGenerator
 */
function ImageController(
    session,
    sessionConstraints,
    sessionContext,
    inputMemberId,
    objectNameGenerator
    ) {
    "use strict";

    var /**@const
           @type{!Object.<!string, !string>}*/
        fileExtensionByMimetype = {
            "image/gif": ".gif",
            "image/jpeg": ".jpg",
            "image/png": ".png"
        },
        /**@const
           @type{!string}*/
        textns = Namespaces.textns,
        odtDocument = session.getOdtDocument(),
        formatting = odtDocument.getFormatting(),
        eventNotifier = new EventNotifier([
            HyperlinkController.enabledChanged
        ]),
        isEnabled = false;

    /**
     * @return {undefined}
     */
    function updateEnabledState() {
        var /**@type{!boolean}*/newIsEnabled = true;

        if (sessionConstraints.getState(CommonConstraints.EDIT.REVIEW_MODE) === true) {
            newIsEnabled = /**@type{!boolean}*/(sessionContext.isLocalCursorWithinOwnAnnotation());
        }

        if (newIsEnabled !== isEnabled) {
            isEnabled = newIsEnabled;
            eventNotifier.emit(ImageController.enabledChanged, isEnabled);
        }
    }

    /**
     * @param {!OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorEvent(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updateEnabledState();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return isEnabled;
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };


    /**
     * @param {!string} name
     * @return {!Operation}
     */
    function createAddGraphicsStyleOp(name) {
        var op = new OpAddStyle();
        op.init({
            memberid: inputMemberId,
            styleName: name,
            styleFamily: 'graphic',
            isAutomaticStyle: false,
            setProperties: {
                "style:graphic-properties": {
                    "text:anchor-type": "paragraph",
                    "svg:x": "0cm",
                    "svg:y": "0cm",
                    "style:wrap": "dynamic",
                    "style:number-wrapped-paragraphs": "no-limit",
                    "style:wrap-contour": "false",
                    "style:vertical-pos": "top",
                    "style:vertical-rel": "paragraph",
                    "style:horizontal-pos": "center",
                    "style:horizontal-rel": "paragraph"
                }
            }
        });
        return op;
    }

    /**
     * @param {!string} styleName
     * @param {!string} parentStyleName
     * @return {!Operation}
     */
    function createAddFrameStyleOp(styleName, parentStyleName) {
        var op = new OpAddStyle();
        op.init({
            memberid: inputMemberId,
            styleName: styleName,
            styleFamily: 'graphic',
            isAutomaticStyle: true,
            setProperties: {
                "style:parent-style-name": parentStyleName,
                // a list of properties would be generated by default when inserting a image in LO.
                // They have no UI impacts in webodf, but copied here in case LO requires them to display image correctly.
                "style:graphic-properties": {
                    "style:vertical-pos": "top",
                    "style:vertical-rel": "baseline",
                    "style:horizontal-pos": "center",
                    "style:horizontal-rel": "paragraph",
                    "fo:background-color": "transparent",
                    "style:background-transparency": "100%",
                    "style:shadow": "none",
                    "style:mirror": "none",
                    "fo:clip": "rect(0cm, 0cm, 0cm, 0cm)",
                    "draw:luminance": "0%",
                    "draw:contrast": "0%",
                    "draw:red": "0%",
                    "draw:green": "0%",
                    "draw:blue": "0%",
                    "draw:gamma": "100%",
                    "draw:color-inversion": "false",
                    "draw:image-opacity": "100%",
                    "draw:color-mode": "standard"
                }
            }
        });
        return op;
    }

    /**
     * @param {!string} mimetype
     * @return {?string}
     */
    function getFileExtension(mimetype) {
        mimetype = mimetype.toLowerCase();
        return fileExtensionByMimetype.hasOwnProperty(mimetype) ? fileExtensionByMimetype[mimetype] : null;
    }

    /**
     * @param {!string} mimetype
     * @param {!string} content base64 encoded string
     * @param {!string} widthMeasure Width + units of the image
     * @param {!string} heightMeasure Height + units of the image
     * @return {undefined}
     */
    function insertImageInternal(mimetype, content, widthMeasure, heightMeasure) {
        var /**@const@type{!string}*/graphicsStyleName = "Graphics",
            stylesElement = odtDocument.getOdfCanvas().odfContainer().rootElement.styles,
            fileExtension = getFileExtension(mimetype),
            fileName,
            graphicsStyleElement,
            frameStyleName,
            op, operations = [];

        runtime.assert(fileExtension !== null, "Image type is not supported: " + mimetype);
        fileName = "Pictures/" + objectNameGenerator.generateImageName() + fileExtension;

        // TODO: eliminate duplicate image
        op = new OpSetBlob();
        op.init({
            memberid: inputMemberId,
            filename: fileName,
            mimetype: mimetype,
            content: content
        });
        operations.push(op);

        // Add the 'Graphics' style if it does not exist in office:styles. It is required by LO to popup the
        // picture option dialog when double clicking the image
        // TODO: in collab mode this can result in unsolvable conflict if two add this style at the same time
        graphicsStyleElement = formatting.getStyleElement(graphicsStyleName, "graphic", [stylesElement]);
        if (!graphicsStyleElement) {
            op = createAddGraphicsStyleOp(graphicsStyleName);
            operations.push(op);
        }

        // TODO: reuse an existing graphic style (if there is one) that has same style as default;
        frameStyleName = objectNameGenerator.generateStyleName();
        op = createAddFrameStyleOp(frameStyleName, graphicsStyleName);
        operations.push(op);

        op = new OpInsertImage();
        op.init({
            memberid: inputMemberId,
            position: odtDocument.getCursorPosition(inputMemberId),
            filename: fileName,
            frameWidth: widthMeasure,
            frameHeight: heightMeasure,
            frameStyleName: frameStyleName,
            frameName: objectNameGenerator.generateFrameName()
        });
        operations.push(op);

        session.enqueue(operations);
    }

    /**
     * Scales the supplied image rect to fit within the page content horizontal
     * and vertical limits, whilst preserving the aspect ratio.
     *
     * @param {!{width: number, height: number}} originalSize
     * @param {!{width: number, height: number}} pageContentSize
     * @return {!{width: number, height: number}}
     */
    function scaleToAvailableContentSize(originalSize, pageContentSize) {
        var widthRatio = 1,
            heightRatio = 1,
            ratio;
        if (originalSize.width > pageContentSize.width) {
            widthRatio = pageContentSize.width / originalSize.width;
        }
        if (originalSize.height > pageContentSize.height) {
            heightRatio = pageContentSize.height / originalSize.height;
        }
        ratio = Math.min(widthRatio, heightRatio);
        return {
            width: originalSize.width * ratio,
            height: originalSize.height * ratio
        };
    }

    /**
     * @param {!string} mimetype
     * @param {!string} content base64 encoded string
     * @param {!number} widthInPx
     * @param {!number} heightInPx
     * @return {undefined}
     */
    this.insertImage = function (mimetype, content, widthInPx, heightInPx) {
        if (!isEnabled) {
            return;
        }

        var paragraphElement,
            styleName,
            pageContentSize,
            imageSize;

        runtime.assert(widthInPx > 0 && heightInPx > 0, "Both width and height of the image should be greater than 0px.");
        imageSize = {
            width: widthInPx,
            height: heightInPx
        };
        // TODO: resize the image to fit in a cell if paragraphElement is in a table-cell
        paragraphElement = odfUtils.getParagraphElement(odtDocument.getCursor(inputMemberId).getNode());
        styleName = paragraphElement.getAttributeNS(textns, 'style-name');
        if (styleName) {
            // TODO cope with no paragraph style name being specified (i.e., use the default paragraph style)
            pageContentSize = formatting.getContentSize(styleName, 'paragraph');
            imageSize = scaleToAvailableContentSize(imageSize, pageContentSize);
        }

        /* LO seems to be unable to digest px width and heights for image frames, and instead shows such
           images as being 0.22" squares. To avoid that, let's use cm dimensions.
         */
        insertImageInternal(mimetype, content,
            cssUnits.convert(imageSize.width, "px", "cm") + "cm",
            cssUnits.convert(imageSize.height, "px", "cm") + "cm"
        );
    };

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(OpsDocument.signalCursorMoved, onCursorEvent);
        sessionConstraints.unsubscribe(CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        callback();
    };

    function init() {
        odtDocument.subscribe(OpsDocument.signalCursorMoved, onCursorEvent);
        sessionConstraints.subscribe(CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        updateEnabledState();
    }
    init();
}

/**@const*/ImageController.enabledChanged = "enabled/changed";
/**@const*/
exports.ImageController = ImageController;
