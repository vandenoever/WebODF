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
var OdtCursor = require("./OdtCursor").OdtCursor;
var OdtDocument = require("./OdtDocument").OdtDocument;
var OpsDocument = require("./Document").Document;
var Formatting = require("../odf/Formatting").Formatting;
var Namespaces = require("../odf/Namespaces").Namespaces;

/**@typedef{!Object.<!string,(!string|!Object.<!string,!string>)>}*/
Formatting.StyleData;

/**
 * @constructor
 * @implements op.Operation
 */
function OpAddStyle() {
    "use strict";

    var memberid, timestamp,
        styleName, styleFamily, isAutomaticStyle,
        /**@type{!Formatting.StyleData}*/setProperties,
        /** @const */stylens = Namespaces.stylens;

    /**
     * @param {!OpAddStyle.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        styleName = data.styleName;
        styleFamily = data.styleFamily;
        // Input is either from an xml doc or potentially a manually created op
        // This means isAutomaticStyles is either a raw string of 'true', or a a native bool
        // Can't use Boolean(...) as Boolean('false') === true
        isAutomaticStyle = data.isAutomaticStyle === 'true' || data.isAutomaticStyle === true;
        setProperties = data.setProperties;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!OpsDocument} document
     */
    this.execute = function (document) {
        var odtDocument = /**@type{OdtDocument}*/(document),
            odfContainer = odtDocument.getOdfCanvas().odfContainer(),
            formatting = odtDocument.getFormatting(),
            dom = odtDocument.getDOMDocument(),
            styleNode = dom.createElementNS(stylens, 'style:style');

        if (!styleNode) {
            return false;
        }

        if (setProperties) {
            formatting.updateStyle(styleNode, setProperties);
        }

        styleNode.setAttributeNS(stylens, 'style:family', styleFamily);
        styleNode.setAttributeNS(stylens, 'style:name', styleName);

        if (isAutomaticStyle) {
            odfContainer.rootElement.automaticStyles.appendChild(styleNode);
        } else {
            odfContainer.rootElement.styles.appendChild(styleNode);
        }

        odtDocument.getOdfCanvas().refreshCSS();
        if (!isAutomaticStyle) {
            odtDocument.emit(OdtDocument.signalCommonStyleCreated, {name: styleName, family: styleFamily});
        }
        return true;
    };

    /**
     * @return {!OpAddStyle.Spec}
     */
    this.spec = function () {
        return {
            optype: "AddStyle",
            memberid: memberid,
            timestamp: timestamp,
            styleName: styleName,
            styleFamily: styleFamily,
            isAutomaticStyle: isAutomaticStyle,
            setProperties: setProperties
        };
    };
}

/**
 * @record
 * @extends {op.SpecBase}
 */
OpAddStyle.InitSpec = function() {}
/**@type{!string}*/
OpAddStyle.InitSpec.prototype.styleName;
/**@type{!string}*/
OpAddStyle.InitSpec.prototype.styleFamily;
/**@type{(!boolean|!string)}*/
OpAddStyle.InitSpec.prototype.isAutomaticStyle;
/**@type{!Formatting.StyleData}*/
OpAddStyle.InitSpec.prototype.setProperties;

/**
 * @record
 * @extends {op.TypedOperationSpec}
 * @extends {OpAddStyle.InitSpec}
 */
OpAddStyle.Spec = function() {}

/**@const*/
exports.OpAddStyle = OpAddStyle;
