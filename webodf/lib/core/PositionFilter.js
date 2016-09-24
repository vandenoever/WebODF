/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
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

/**
 * @interface
 */
function PositionFilter() {"use strict"; };
/**
 * @enum {number}
 */
PositionFilter.FilterResult = {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP:   3
};
/**
 * @param {!PositionIterator} point
 * @return {!PositionFilter.FilterResult}
 */
PositionFilter.prototype.acceptPosition = function (point) {"use strict"; };
/**@const*/
exports.PositionFilter = PositionFilter;
