/**
 * Copyright (C) 2013 KO GmbH <aditya.bhatt@kogmbh.com>
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

/*jslint emptyblock: true, unparam: true*/

var PositionIterator = require("./PositionIterator").PositionIterator;
var PositionFilter = require("./PositionFilter").PositionFilter;

/**
 * A structure that acts like a filter for all purposes,
 * and also can be combined with other instances of it's own kind or other filters.
 * @constructor
 * @implements {PositionFilter}
 */
function PositionFilterChain() {
    "use strict";

    var /**@type{!Array.<!PositionFilter|!PositionFilterChain>}*/
        filterChain = [],
        /**@const*/
        FILTER_ACCEPT = PositionFilter.FilterResult.FILTER_ACCEPT,
        /**@const*/
        FILTER_REJECT  = PositionFilter.FilterResult.FILTER_REJECT;

    /**
     * Returns accept if all filters in the chain accept the position, else reject.
     * @param {!PositionIterator} iterator
     * @return {!PositionFilter.FilterResult}
     */
    this.acceptPosition = function (iterator) {
        var i;
        for (i = 0; i < filterChain.length; i += 1) {
            if (filterChain[i].acceptPosition(iterator) === FILTER_REJECT) {
                return FILTER_REJECT;
            }
        }
        return FILTER_ACCEPT;
    };

    /**
     * Adds a filter to the filter chain.
     * @param {!PositionFilter|!PositionFilterChain} filterInstance
     * @return {undefined}
     */
    this.addFilter = function (filterInstance) {
        filterChain.push(filterInstance);
    };
}
/**@const*/
exports.PositionFilterChain = PositionFilterChain;
