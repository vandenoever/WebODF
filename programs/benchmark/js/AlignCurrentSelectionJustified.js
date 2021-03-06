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

define(["BenchmarkAction"], function(BenchmarkAction) {
    "use strict";

    /**
     * Align the current selection 'justify'
     * @constructor
     */
    function AlignCurrentSelectionJustified() {
        var state = {description: "Align the current selection 'justify'"},
            action = new BenchmarkAction(state);

        this.subscribe = action.subscribe;
        this.state = state;

        /**
         * @param {!OdfBenchmarkContext} context
         * @return {undefined}
         */
        this.start = function(context) {
            context.recordDistanceFromCurrentSelection(state);
            action.start();
            context.sessionController.getDirectFormattingController().alignParagraphJustified();
            action.stop();
            action.complete(true);
        }
    }

    return AlignCurrentSelectionJustified;
});
