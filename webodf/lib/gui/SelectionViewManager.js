/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

var OdtCursor = require("../ops/OdtCursor").OdtCursor;
var SelectionView = require("./SelectionView").SelectionView;
var ShadowCursor = require("./ShadowCursor").ShadowCursor;
var Destroyable = require("../core/Destroyable").Destroyable;
var EventNotifier = require("../core/EventNotifier").EventNotifier;

/**
 * The Selection View Manager is responsible for managing SelectionView objects
 * and attaching/detaching them to cursors.
 * @constructor
 * @implements {Destroyable}
 * @param {!function(new:SelectionView, !(OdtCursor|ShadowCursor))} SelectionView
 */
function SelectionViewManager(SelectionViewConstructor) {
    "use strict";
    var /**@type{!Object.<string,SelectionView>}*/
        selectionViews = {};

    /**
     * @param {!string} memberId
     * @return {?SelectionView}
     */
    function getSelectionView(memberId) {
        return selectionViews.hasOwnProperty(memberId) ? selectionViews[memberId] : null;
    }
    this.getSelectionView = getSelectionView;

    /**
     * @return {!Array.<!SelectionView>}
     */
    function getSelectionViews() {
        return Object.keys(selectionViews).map(function (memberid) { return selectionViews[memberid]; });
    }
    this.getSelectionViews = getSelectionViews;

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function removeSelectionView(memberId) {
        if (selectionViews.hasOwnProperty(memberId)) {
            /*jslint emptyblock: true*/
            selectionViews[memberId].destroy(function () { });
            /*jslint emptyblock: false*/
            delete selectionViews[memberId];
        }
    }
    this.removeSelectionView = removeSelectionView;

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function hideSelectionView(memberId) {
        if (selectionViews.hasOwnProperty(memberId)) {
            selectionViews[memberId].hide();
        }
    }
    this.hideSelectionView = hideSelectionView;

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function showSelectionView(memberId) {
        if (selectionViews.hasOwnProperty(memberId)) {
            selectionViews[memberId].show();
        }
    }
    this.showSelectionView = showSelectionView;

    /**
     * Rerenders the selection views that are already visible
     * @return {undefined}
     */
    this.rerenderSelectionViews = function () {
        Object.keys(selectionViews).forEach(function (memberId) {
            selectionViews[memberId].rerender();
        });
    };

    /**
     * @param {!(OdtCursor|ShadowCursor)} cursor
     * @param {!boolean} virtualSelectionsInitiallyVisible
     * @return {!SelectionView}
     */
    this.registerCursor = function (cursor, virtualSelectionsInitiallyVisible) {
        var memberId = cursor.getMemberId(),
            selectionView = new SelectionViewConstructor(cursor);

        if (virtualSelectionsInitiallyVisible) {
            selectionView.show();
        } else {
            selectionView.hide();
        }

        selectionViews[memberId] = selectionView;
        return selectionView;
    };

    /**
     * @param {function(!Error=)} callback
     */
    this.destroy = function (callback) {
        var selectionViewArray = getSelectionViews();

        /**
         * @param {!number} i
         * @param {!Error=} err
         * @return {undefined}
         */
        function destroySelectionView(i, err) {
            if (err) {
                callback(err);
            } else {
                if (i < selectionViewArray.length) {
                    selectionViewArray[i].destroy(function (err) {
                        destroySelectionView(i + 1, err);
                    });
                } else {
                    callback();
                }
            }
        }
        destroySelectionView(0, undefined);
    };
}
/**@const*/
exports.SelectionViewManager = SelectionViewManager;
