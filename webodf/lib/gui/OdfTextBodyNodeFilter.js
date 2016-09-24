/**
 * Copyright (C) 2010-2014 KO GmbH <copyright@kogmbh.com>
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

/*global NodeFilter, Node*/
var odfUtils = require("../odf/OdfUtils");
var Namespaces = require("../odf/Namespaces").Namespaces;

/**
 * Exclude nodes that do not make up part of the ODF's text body. This includes:
 * - Any text node that is not within a text grouping element
 * - Any node within a text:tracked-changes block
 *
 * @constructor
 * @implements NodeFilter
 */
function OdfTextBodyNodeFilter() {
    "use strict";
    var TEXT_NODE = Node.TEXT_NODE,
        FILTER_REJECT = NodeFilter.FILTER_REJECT,
        FILTER_ACCEPT = NodeFilter.FILTER_ACCEPT,
        textns = Namespaces.textns;

    /**
     * @param {!Node} node
     * @return {!number}
     */
    this.acceptNode = function (node) {
        if (node.nodeType === TEXT_NODE) {
            if (!odfUtils.isGroupingElement(node.parentNode)) {
                return FILTER_REJECT;
            }
        } else if (node.namespaceURI === textns && node.localName === "tracked-changes") {
            return FILTER_REJECT;
        }
        return FILTER_ACCEPT;
    };
}
/**@const*/
exports.OdfTextBodyNodeFilter = OdfTextBodyNodeFilter;
