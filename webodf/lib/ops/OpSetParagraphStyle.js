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

var runtime = require("../runtime").runtime;
var op = require("./Operation");
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;
var odfUtils = require("../odf/OdfUtils");
var PositionIterator = require("../core/PositionIterator").PositionIterator;

/**
 * Sets the paragraph style name of the specified paragraph.
 * The supplied position argument is expected to be the first
 * step within the paragraph.
 *
 * @constructor
 * @implements op.Operation
 */
function OpSetParagraphStyle() {
    "use strict";

    var memberid, timestamp, position, styleName,
        textns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";

    /**
     * @param {!OpSetParagraphStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        styleName = data.styleName;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * Returns true if the iterator is set to the first step within the paragraph
     *
     * @param {!OdtDocument} odtDocument
     * @param {!Node} paragraphNode
     * @param {!PositionIterator} iterator
     * @return {!boolean}
     */
    function isFirstStep(odtDocument, paragraphNode, iterator) {
        var filters = [odtDocument.getPositionFilter()],
            container = iterator.container(),
            offset = iterator.unfilteredDomOffset(),
            stepIterator = odtDocument.createStepIterator(container, offset, filters, paragraphNode);

        return stepIterator.previousStep() === false;
    }

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            iterator,
            paragraphNode;

        iterator = odtDocument.getIteratorAtPosition(position);
        paragraphNode = odfUtils.getParagraphElement(iterator.container());
        if (paragraphNode) {
            runtime.assert(isFirstStep(odtDocument, paragraphNode, iterator),
                "SetParagraphStyle position should be the first position in the paragraph");
            if (styleName) {
                paragraphNode.setAttributeNS(textns, 'text:style-name', styleName);
            } else {
                paragraphNode.removeAttributeNS(textns, 'style-name');
            }

            odtDocument.getOdfCanvas().refreshSize();
            odtDocument.emit(OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraphNode,
                timeStamp: timestamp,
                memberId: memberid
            });

            odtDocument.getOdfCanvas().rerenderAnnotations();
            return true;
        }
        return false;
    };

    /**
     * @return {!OpSetParagraphStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "SetParagraphStyle",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            styleName: styleName
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpSetParagraphStyle.InitSpec = function() {}
/**@type{!number}*/
OpSetParagraphStyle.InitSpec.prototype.position;
/**@type{!string}*/
OpSetParagraphStyle.InitSpec.prototype.styleName;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpSetParagraphStyle.InitSpec}
 */
OpSetParagraphStyle.Spec = function() {}

/**@const*/
exports.OpSetParagraphStyle = OpSetParagraphStyle;
