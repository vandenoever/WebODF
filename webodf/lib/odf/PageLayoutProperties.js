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
 * @param {?Element} element
 * @param {!PageLayoutProperties|undefined} parent
 */
function PageLayoutProperties(element, parent) {
    "use strict";
    var self = this,
        fons = Namespaces.fons,
        getter;
    getter = {
        pageHeight: function () {
            var a, value;
            if (element) {
                a = element.getAttributeNS(fons, "page-height");
                value = styleParseUtils.parseLength(a);
            }
            return value;
        },
        pageWidth: function () {
            var a, value;
            if (element) {
                a = element.getAttributeNS(fons, "page-width");
                value = styleParseUtils.parseLength(a);
            }
            return value;
        }
    };
    /**
     * @return {!number}
     */
    this.pageHeight = function () {
        return /**@type{!number|undefined}*/(self.data.value("pageHeight"))
                || 1123; // A4 height
    };
    /**
     * @return {!number}
     */
    this.pageWidth = function () {
        return /**@type{!number|undefined}*/(self.data.value("pageWidth"))
                || 794; // A4 width
    };
    /**
     * @type {!styleParseUtils.LazyStyleProperties|undefined}
     */
    this.data;
    function init() {
        var p = parent === undefined ? undefined : parent.data;
        self.data = new styleParseUtils.LazyStyleProperties(p, getter);
    }
    init();
}
/**
 * @constructor
 * @param {?Element} element
 * @param {!PageLayout=} parent
 */
function PageLayout(element, parent) {
    "use strict";
    var self = this;
    /**
     * @type {!PageLayoutProperties}
     */
    this.pageLayout;
    function init() {
        var e = null;
        if (element) {
            e = styleParseUtils.getPropertiesElement("page-layout-properties",
                 element);
        }
        self.pageLayout = new PageLayoutProperties(e,
                (parent && parent.pageLayout));
    }
    init();
}
/**@const*/
exports.PageLayout = PageLayout;
/*jslint emptyblock: true, unparam: true*/
/**
 * @interface
 */
function PageLayoutCache() {"use strict"; }
/**
 * @param {!string} name
 * @return {!PageLayout}
 */
PageLayoutCache.prototype.getPageLayout = function (name) {"use strict"; };
/**
 * @return {!PageLayout}
 */
PageLayoutCache.prototype.getDefaultPageLayout = function () {"use strict"; };
/*jslint emptyblock: false, unparam: false*/
/**@const*/
exports.PageLayoutCache = PageLayoutCache;
