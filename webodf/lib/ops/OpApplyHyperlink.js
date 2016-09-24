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

/*global Node*/

var runtime = require("../runtime").runtime;
var op = require("./Operation");
var OdtCursor = require("./OdtCursor").OdtCursor;
var OpsDocument = require("./Document").Document;
var Namespaces = require("../odf/Namespaces").Namespaces;
var OdtDocument = require("./OdtDocument").OdtDocument;
var odfUtils = require("../odf/OdfUtils");
var domUtils = require("../core/DomUtils");

/**
 * @constructor
 * @implements op.Operation
 */
function OpApplyHyperlink() {
    "use strict";

    var memberid, timestamp, position, length, hyperlink;

    /**
     * @param {!OpApplyHyperlink.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        length = data.length;
        hyperlink = data.hyperlink;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!Document} document
     * @param {string} hyperlink
     * @return {!Element}
     */
    function createHyperlink(document, hyperlink) {
        var node = document.createElementNS(Namespaces.textns, 'text:a');
        node.setAttributeNS(Namespaces.xlinkns, 'xlink:type', 'simple');
        node.setAttributeNS(Namespaces.xlinkns, 'xlink:href', hyperlink);
        return node;
    }

    /**
     * @param {?Node} node
     * @return {boolean}
     */
    function isPartOfLink(node) {
        while (node) {
            if (odfUtils.isHyperlink(node)) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    /**
     * TODO: support adding image link
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            ownerDocument = odtDocument.getDOMDocument(),
            range = odtDocument.convertCursorToDomRange(position, length),
            boundaryNodes = domUtils.splitBoundaries(range),
            /**@type{!Array.<!Element>}*/
            modifiedParagraphs = [],
            textNodes = odfUtils.getTextNodes(range, false);

        if (textNodes.length === 0) {
            return false;
        }

        textNodes.forEach(function (node) {
            var linkNode,
                paragraph = odfUtils.getParagraphElement(node);
            runtime.assert(isPartOfLink(node) === false, "The given range should not contain any link.");
            // TODO there could be a small efficiency gain by merging adjacent text nodes into a single hyperlink parent.
            // This is probably only a corner case however and there are not likely to be major repercussions for not doing it
            linkNode = createHyperlink(ownerDocument, hyperlink);
            node.parentNode.insertBefore(linkNode, node);
            linkNode.appendChild(node);
            if (paragraph !== null
                    && modifiedParagraphs.indexOf(paragraph) === -1) {
                modifiedParagraphs.push(paragraph);
            }
        });


        boundaryNodes.forEach(domUtils.normalizeTextNodes);
        range.detach();

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.getOdfCanvas().rerenderAnnotations();
        modifiedParagraphs.forEach(function (paragraph) {
            odtDocument.emit(OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraph,
                memberId: memberid,
                timeStamp: timestamp
            });
        });

        return true;
    };

    /**
     * @return {!OpApplyHyperlink.Spec}
     */
    this.spec = function () {
        return {
            optype: "ApplyHyperlink",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            hyperlink: hyperlink
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpApplyHyperlink.InitSpec = function() {}
/**@type{!number}*/
OpApplyHyperlink.InitSpec.prototype.position;
/**@type{!number}*/
OpApplyHyperlink.InitSpec.prototype.length;
/**@type{!string}*/
OpApplyHyperlink.InitSpec.prototype.hyperlink;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpApplyHyperlink.InitSpec}
 */
OpApplyHyperlink.Spec = function() {}

/**@const*/
exports.OpApplyHyperlink = OpApplyHyperlink;
