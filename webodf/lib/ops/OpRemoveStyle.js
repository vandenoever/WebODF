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

var op = require("./Operation");
var OpsDocument = require("./Document").Document;
var OdtDocument = require("./OdtDocument").OdtDocument;

/**
 * @constructor
 * @implements op.Operation
 */
function OpRemoveStyle() {
    "use strict";

    var memberid, timestamp, styleName, styleFamily;

    /**
     * @param {!OpRemoveStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        styleName = data.styleName;
        styleFamily = data.styleFamily;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            styleNode = odtDocument.getFormatting().getStyleElement(styleName, styleFamily);

        if (!styleNode) {
            return false;
        }

        styleNode.parentNode.removeChild(styleNode);

        odtDocument.getOdfCanvas().refreshCSS();
        odtDocument.emit(OdtDocument.signalCommonStyleDeleted, {name: styleName, family: styleFamily});
        return true;
    };

    /**
     * @return {!OpRemoveStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "RemoveStyle",
            memberid: memberid,
            timestamp: timestamp,
            styleName: styleName,
            styleFamily: styleFamily
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpRemoveStyle.InitSpec = function() {}
/**@type{!string}*/
OpRemoveStyle.InitSpec.prototype.styleName;
/**@type{!string}*/
OpRemoveStyle.InitSpec.prototype.styleFamily;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpRemoveStyle.InitSpec}
 */
OpRemoveStyle.Spec = function() {}

/**@const*/
exports.OpRemoveStyle = OpRemoveStyle;
