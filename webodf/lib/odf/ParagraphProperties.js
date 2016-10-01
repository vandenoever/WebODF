/**
 * Copyright (C) 2014 KO GmbH <copyright@kogmbh.com>
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

var styleParseUtils = require("./StyleParseUtils");
var Namespaces = require("./Namespaces").Namespaces;

/**
 * @constructor
 * @param {!Element} element
 * @param {!ParagraphProperties|undefined} parent
 */
function ParagraphProperties(element, parent) {
    "use strict";
    var self = this,
        fons = Namespaces.fons,
        getter;
    getter = {
        marginTop: function () {
            var a = element.getAttributeNS(fons, "margin-top"),
                value = styleParseUtils.parsePositiveLengthOrPercent(a,
                    "marginTop", parent && parent.data);
            return value;
        }
    };
    /**
     * @return {!number|undefined}
     */
    this.marginTop = function () {
        return /**@type{!number|undefined}*/(self.data.value("marginTop"));
    };
    /**
     * @type {!styleParseUtils.LazyStyleProperties}
     */
    this.data;
    function init() {
        var p = parent === undefined ? undefined : parent.data;
        self.data = new styleParseUtils.LazyStyleProperties(p, getter);
    }
    init();
}
/**@const*/
exports.ParagraphProperties = ParagraphProperties;
/**
 * @constructor
 */
function ComputedParagraphProperties() {
    "use strict";
    var /**@type{!Object.<!string,*>}*/
        data = {},
        /**@type{!Array.<!ParagraphProperties>}*/
        styleChain = [];
    /**
     * @param {!string} name
     * @return {*}
     */
    function value(name) {
        var v, i;
        if (data.hasOwnProperty(name)) {
            v = data[name];
        } else {
            for (i = 0; v === undefined && i < styleChain.length; i += 1) {
                v = /**@type{!function():*}*/(styleChain[i][name])();
            }
            data[name] = v;
        }
        return v;
    }
    /**
     * @param {!Array.<!ParagraphProperties>} newStyleChain
     * @return {undefined}
     */
    this.setStyleChain = function setStyleChain(newStyleChain) {
        styleChain = newStyleChain;
        data = {};
    };
    /**
     * @return {!number}
     */
    this.marginTop = function () {
        return /**@type{!number}*/(value("marginTop")) || 0;
    };
}
/**@const*/
exports.ComputedParagraphProperties = ComputedParagraphProperties;
