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
var OdtDocument = require("./OdtDocument").OdtDocument;
var op = require("./Operation");
var OdtCursor = require("./OdtCursor").OdtCursor;
var OpsDocument = require("./Document").Document;
var Formatting = require("../odf/Formatting").Formatting;
var OdfContainer = require("../odf/OdfContainer").OdfContainer;
var TextStyleApplicator = require("../odf/TextStyleApplicator").TextStyleApplicator;
var ObjectNameGenerator = require("../odf/ObjectNameGenerator").ObjectNameGenerator;
var odfUtils = require("../odf/OdfUtils");
var domUtils = require("../core/DomUtils");

/**@typedef{!Object.<!string,(!string|!Object.<!string,!string>)>}*/
Formatting.StyleData;

/**
 * @constructor
 * @implements op.Operation
 */
function OpApplyDirectStyling() {
    "use strict";

    var memberid, timestamp,
        /**@type {number}*/
        position,
        /**@type {number}*/
        length,
        /**@type{!Formatting.StyleData}*/
        setProperties;

    /**
     * @param {!OpApplyDirectStyling.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = parseInt(data.position, 10);
        length = parseInt(data.length, 10);
        setProperties = data.setProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * Apply the specified style properties to all elements within the given range.
     * Currently, only text styles are applied.
     * @param {!OdtDocument} odtDocument
     * @param {!Range} range Range to apply text style to
     * @param {!Object} info Style information. Only data within "style:text-properties" will be considered and applied
     */
    function applyStyle(odtDocument, range, info) {
        var odfCanvas = odtDocument.getOdfCanvas(),
            odfContainer = odfCanvas.odfContainer(),
            nextTextNodes = domUtils.splitBoundaries(range),
            textNodes = odfUtils.getTextNodes(range, false),
            textStyles;

        textStyles = new TextStyleApplicator(
            new ObjectNameGenerator(/**@type{!OdfContainer}*/(odfContainer), memberid), // TODO: use the instance in SessionController
            odtDocument.getFormatting(),
            odfContainer.rootElement.automaticStyles
        );
        textStyles.applyStyle(textNodes, range, info);
        nextTextNodes.forEach(domUtils.normalizeTextNodes);
    }

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            range = odtDocument.convertCursorToDomRange(position, length),
            impactedParagraphs = odfUtils.getParagraphElements(range);

        applyStyle(odtDocument, range, setProperties);

        range.detach();
        odtDocument.getOdfCanvas().refreshCSS();
        odtDocument.fixCursorPositions(); // The container splits may leave the cursor in an invalid spot

        impactedParagraphs.forEach(function (n) {
            odtDocument.emit(OdtDocument.signalParagraphChanged, {
                paragraphElement: n,
                memberId: memberid,
                timeStamp: timestamp
            });
        });

        odtDocument.getOdfCanvas().rerenderAnnotations();
        return true;
    };

    /**
     * @return {!OpApplyDirectStyling.Spec}
     */
    this.spec = function () {
        return {
            optype: "ApplyDirectStyling",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            length: length,
            setProperties: setProperties
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpApplyDirectStyling.InitSpec = function() {}
/**@type{!number}*/
OpApplyDirectStyling.InitSpec.prototype.position;
/**@type{!number}*/
OpApplyDirectStyling.InitSpec.prototype.length;
/**@type{!Formatting.StyleData}*/
OpApplyDirectStyling.InitSpec.prototype.setProperties;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpApplyDirectStyling.InitSpec}
 */
OpApplyDirectStyling.Spec = function() {}

/**@const*/
exports.OpApplyDirectStyling = OpApplyDirectStyling;
