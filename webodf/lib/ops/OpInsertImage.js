/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
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

var Namespaces = require("../odf/Namespaces").Namespaces;
var op = require("./Operation");
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;
var odfUtils = require("../odf/OdfUtils");

/**
 * @constructor
 * @implements op.Operation
 */
function OpInsertImage() {
    "use strict";

    var memberid, timestamp, position, filename, frameWidth, frameHeight, frameStyleName, frameName,
        drawns = Namespaces.drawns,
        svgns = Namespaces.svgns,
        textns = Namespaces.textns,
        xlinkns = Namespaces.xlinkns;

    /**
     * @param {!OpInsertImage.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        filename = data.filename;
        frameWidth = data.frameWidth;
        frameHeight = data.frameHeight;
        frameStyleName = data.frameStyleName;
        frameName = data.frameName;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!Document} document
     * @return {!Element}
     */
    function createFrameElement(document) {
        var imageNode = document.createElementNS(drawns, 'draw:image'),
            frameNode = document.createElementNS(drawns, 'draw:frame');

        imageNode.setAttributeNS(xlinkns, 'xlink:href', filename);
        imageNode.setAttributeNS(xlinkns, 'xlink:type', 'simple');
        imageNode.setAttributeNS(xlinkns, 'xlink:show', 'embed');
        imageNode.setAttributeNS(xlinkns, 'xlink:actuate', 'onLoad');

        frameNode.setAttributeNS(drawns, 'draw:style-name', frameStyleName);
        frameNode.setAttributeNS(drawns, 'draw:name', frameName);
        frameNode.setAttributeNS(textns, 'text:anchor-type', 'as-char');
        frameNode.setAttributeNS(svgns, 'svg:width', frameWidth);
        frameNode.setAttributeNS(svgns, 'svg:height', frameHeight);
        frameNode.appendChild(imageNode);

        return frameNode;
    }

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            odfCanvas = odtDocument.getOdfCanvas(),
            domPosition = odtDocument.getTextNodeAtStep(position, memberid),
            textNode, refNode, paragraphElement, frameElement;

        if (!domPosition) {
            return false;
        }

        textNode = domPosition.textNode;
        paragraphElement = odfUtils.getParagraphElement(textNode);
        refNode = domPosition.offset !== textNode.length ?
            textNode.splitText(domPosition.offset) : textNode.nextSibling;
        frameElement = createFrameElement(odtDocument.getDOMDocument());
        textNode.parentNode.insertBefore(frameElement, refNode);
        odtDocument.emit(OdtDocument.signalStepsInserted, {position: position});

        // clean up any empty text node which was created by odtDocument.getTextNodeAtStep
        if (textNode.length === 0) {
            textNode.parentNode.removeChild(textNode);
        }

        odfCanvas.addCssForFrameWithImage(frameElement);
        odfCanvas.refreshCSS();
        odtDocument.emit(OdtDocument.signalParagraphChanged, {
            paragraphElement: paragraphElement,
            memberId: memberid,
            timeStamp: timestamp
        });
        odfCanvas.rerenderAnnotations();
        return true;
    };

    /**
     * @return {!OpInsertImage.Spec}
     */
    this.spec = function () {
        return {
            optype: "InsertImage",
            memberid: memberid,
            timestamp: timestamp,
            filename: filename,
            position: position,
            frameWidth: frameWidth,
            frameHeight: frameHeight,
            frameStyleName: frameStyleName,
            frameName: frameName
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpInsertImage.InitSpec = function() {}
/**@type{!string}*/
OpInsertImage.InitSpec.prototype.filename;
/**@type{!number}*/
OpInsertImage.InitSpec.prototype.position;
/**@type{!string}*/
OpInsertImage.InitSpec.prototype.frameWidth;
/**@type{!string}*/
OpInsertImage.InitSpec.prototype.frameHeight;
/**@type{!string}*/
OpInsertImage.InitSpec.prototype.frameStyleName;
/**@type{!string}*/
OpInsertImage.InitSpec.prototype.frameName;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpInsertImage.InitSpec}
 */
OpInsertImage.Spec = function() {}

/**@const*/
exports.OpInsertImage = OpInsertImage;
