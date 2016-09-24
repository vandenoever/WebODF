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

/*jslint emptyblock:true, unparam:true*/

var StepIterator = require("../core/StepIterator").StepIterator;
var StepDirection = require("../core/enums").StepDirection;

/**
 * @constructor
 * @struct
 */
function StepInfo() { "use strict"; }

/**
 * Visual step iteration direction, taking into account
 * whether the text block is right-to-left or left to right.
 *
 * For left-to-right languages, this maps onto
 * StepDirection as:
 *  LEFT_TO_RIGHT = NEXT
 *  RIGHT_TO_LEFT = PREV
 *
 * @enum {!number}
 */
StepInfo.VisualDirection = {
    LEFT_TO_RIGHT: 0,
    RIGHT_TO_LEFT: 1
};

/**
 * @type {!StepIterator.StepSnapshot}
 */
StepInfo.prototype.token;

/**
 * @return {!Element|!Text}
 */
StepInfo.prototype.container = function() { "use strict"; };

/**
 * @return {!number}
 */
StepInfo.prototype.offset = function() { "use strict"; };

/**
 * The direction of iteration from previous to next rect.
 *
 * @type {!StepDirection}
 */
StepInfo.prototype.direction;

/**
 * The visual direction of iteration accounting for right-to-left
 * languages.
 *
 * @type {!StepInfo.VisualDirection}
 */
StepInfo.prototype.visualDirection;

/**
 * Scanners are stateful objects that are used to locate a step matching certain
 * parameters within a sequence. This a similar concept to lexical scanners.
 *
 * As these are stateful objects, a new instance should be created for every use.
 * @interface
 */
function VisualStepScanner() { "use strict"; }

/**
 * Token for the last step accepted by this scanner
 * @type {?StepIterator.StepSnapshot|undefined}
 */
VisualStepScanner.prototype.token;

/**
 * @param {!StepInfo} stepInfo
 * @param {?ClientRect} previousRect
 * @param {?ClientRect} nextRect
 * @return {!boolean} Return true in terminate iteration
 */
VisualStepScanner.prototype.process = function(stepInfo, previousRect, nextRect) { "use strict"; };
/**@const*/
exports.StepInfo = StepInfo;
/**@const*/
exports.VisualStepScanner = VisualStepScanner;
