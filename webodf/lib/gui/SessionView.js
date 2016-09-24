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

/*global Node*/
"use strict";

var runtime = require("../runtime").runtime;
var CaretManager = require("./CaretManager").CaretManager;
var SessionConstraints = require("./SessionConstraints").SessionConstraints;
var SelectionViewManager = require("./SelectionViewManager").SelectionViewManager;
var Destroyable = require("../core/Destroyable").Destroyable;
var EditInfo = require("../ops/EditInfo").EditInfo;
var EditInfoMarker = require("./EditInfoMarker").EditInfoMarker;
var task = require("../core/Task");
var async = require("../core/Async");
var OdtDocument = require("../ops/OdtDocument").OdtDocument;
var OdtCursor = require("../ops/OdtCursor").OdtCursor;
var Member = require("../ops/Member").Member;
var Caret = require("./Caret").Caret;
var Session = require("../ops/Session").Session;
var ScheduledTask = require("../core/ScheduledTask").ScheduledTask;
var OdfCanvas = require("../odf/OdfCanvas").OdfCanvas;
var OpsDocument = require("../ops/Document").Document;
var CommonConstraints = require("./CommonConstraints").CommonConstraints;
var ShadowCursor = require("./ShadowCursor").ShadowCursor;
var domUtils = require("../core/DomUtils");

/**
 * @constructor
 * @struct
 */
function SessionViewOptions() {
    /**
     * Set the initial edit information marker visibility
     * @type {boolean}
     */
    this.editInfoMarkersInitiallyVisible = true;

    /**
     * Sets the initial visibility of the avatar
     * @type {boolean}
     */
    this.caretAvatarsInitiallyVisible = true;

    /**
     * Specify that the caret should blink if a non-collapsed range is selected
     * @type {boolean}
     */
    this.caretBlinksOnRangeSelect = true;
}


    /**
     * Return a user-specified option, or the default value if no user option
     * is provided
     * @param {boolean} userValue
     * @param {!boolean} defaultValue
     * @return {!boolean}
     */
    function configOption(userValue, defaultValue) {
        return userValue !== undefined ? Boolean(userValue) : defaultValue;
    }

    /**
     * TODO: We really don't want to let SessionView be aware of localMemberId,
     * so eventually we'll need to refactor this. It is only here so that the id can
     * be matched with the memberids for which CSS is generated, to generate the same CSS
     * for shadow cursors.
     * @constructor
     * @implements {Destroyable}
     * @param {!SessionViewOptions} viewOptions
     * @param {string} localMemberId
     * @param {!Session} session
     * @param {!SessionConstraints} sessionConstraints
     * @param {!CaretManager} caretManager
     * @param {!SelectionViewManager} selectionViewManager
     */
    function SessionView(viewOptions, localMemberId, session, sessionConstraints, caretManager, selectionViewManager) {
        var /**@type{!HTMLStyleElement}*/
            avatarInfoStyles,
            /**@type{!HTMLStyleElement}*/
            annotationConstraintStyles,
            editInfons = 'urn:webodf:names:editinfo',
            /**@type{!Object.<string,!EditInfoMarker>}*/
            editInfoMap = {},
            /**@type{!OdtDocument}*/
            odtDocument,
            /**@type{!OdfCanvas}*/
            odfCanvas,
            /**@type{!ScheduledTask}*/
            highlightRefreshTask,
            showEditInfoMarkers = configOption(viewOptions.editInfoMarkersInitiallyVisible, true),
            showCaretAvatars = configOption(viewOptions.caretAvatarsInitiallyVisible, true),
            blinkOnRangeSelect = configOption(viewOptions.caretBlinksOnRangeSelect, true);

        /**
         * @param {!{memberId: !string, annotation: !Element}} info
         * @return {undefined}
         */
        function onAnnotationAdded(info) {
            if (info.memberId === localMemberId) {
                odfCanvas.getViewport().scrollIntoView(info.annotation.getBoundingClientRect());
            }
        }

        /**
         * @return {!HTMLStyleElement}
         */
        function newStyleSheet() {
            var head = document.getElementsByTagName('head').item(0),
                sheet = /**@type{!HTMLStyleElement}*/(document.createElement('style'));

            sheet.type = 'text/css';
            sheet.media = 'screen, print, handheld, projection';
            head.appendChild(sheet);

            return sheet;
        }

        /**
         * @param {!string} nodeName
         * @param {!string} memberId
         * @param {!string} pseudoClass
         * @return {!string}
         */
        function createAvatarInfoNodeMatch(nodeName, memberId, pseudoClass) {
            return nodeName + '[editinfo|memberid="' + memberId + '"]' + pseudoClass;
        }

        /**
         * @param {!string} nodeName
         * @param {!string} memberId
         * @param {string} pseudoClass
         * @return {?Node}
         */
        function getAvatarInfoStyle(nodeName, memberId, pseudoClass) {
            var node = avatarInfoStyles.firstChild,
                // adding "{" to make sure indexOf(nodeMatch) === 0 does not match longer selectors with same start
                nodeMatch = createAvatarInfoNodeMatch(nodeName, memberId, pseudoClass) + "{";

            while (node) {
                if (node.nodeType === Node.TEXT_NODE && /**@type{!Text}*/(node).data.indexOf(nodeMatch) === 0) {
                    return node;
                }
                node = node.nextSibling;
            }
            return null;
        }

        /**
         * @param {!string} memberId
         * @param {!string} name
         * @param {!string} color
         * @return {undefined}
         */
        function setAvatarInfoStyle(memberId, name, color) {
            /**
             * @param {!string} nodeName
             * @param {!string} rule
             * @param {!string} pseudoClass
             */
            function setStyle(nodeName, rule, pseudoClass) {
                var styleRule = createAvatarInfoNodeMatch(nodeName, memberId, pseudoClass) + rule,
                    styleNode = getAvatarInfoStyle(nodeName, memberId, pseudoClass);

                // TODO: this does not work with Firefox 16.0.1, throws a HierarchyRequestError on first try.
                // And Chromium a "SYNTAX_ERR: DOM Exception 12" now
                // avatarEditedStyles.sheet.insertRule(paragraphStyleName+styleRuleRudimentCStr, 0);
                // Workaround for now:
                if (styleNode) {
                    styleNode.data = styleRule;
                } else {
                    avatarInfoStyles.appendChild(document.createTextNode(styleRule));
                }
            }
            // WARNING: nodeMatch relies on that there is no space before the starting "{"
            setStyle('div.editInfoMarker', '{ background-color: ' + color + '; }', '');
            setStyle('span.editInfoColor', '{ background-color: ' + color + '; }', '');
            setStyle('span.editInfoAuthor', '{ content: "' + name + '"; }', ':before');
            setStyle('dc|creator', '{ background-color: ' + color + '; }', '');
            setStyle('.webodf-selectionOverlay', '{ fill: ' + color + '; stroke: ' + color + ';}', '');
            if (memberId === localMemberId) {
                // Show selection handles for local user
                setStyle('.webodf-touchEnabled .webodf-selectionOverlay', '{ display: block; }', ' > .webodf-draggable');

                // Also set shadow cursor rules for local user
                memberId = ShadowCursor.ShadowCursorMemberId;
                setStyle('.webodf-selectionOverlay', '{ fill: ' + color + '; stroke: ' + color + ';}', '');
                setStyle('.webodf-touchEnabled .webodf-selectionOverlay', '{ display: block; }', ' > .webodf-draggable');
            }
        }

        /**
         * @param {!Element} element
         * @param {!string} memberId
         * @param {!number} timestamp
         * @return {undefined}
         */
        function highlightEdit(element, memberId, timestamp) {
            var editInfo,
                editInfoMarker,
                id = '',
                editInfoNode = element.getElementsByTagNameNS(editInfons, 'editinfo').item(0);

            if (editInfoNode) {
                id = /**@type{!Element}*/(editInfoNode).getAttributeNS(editInfons, 'id');
                editInfoMarker = editInfoMap[id];
            } else {
                id = Math.random().toString();
                editInfo = new EditInfo(element, session.getOdtDocument());
                editInfoMarker = new EditInfoMarker(editInfo, showEditInfoMarkers);

                editInfoNode = /**@type{!Element}*/(element.getElementsByTagNameNS(editInfons, 'editinfo').item(0));
                editInfoNode.setAttributeNS(editInfons, 'id', id);
                editInfoMap[id] = editInfoMarker;
            }

            editInfoMarker.addEdit(memberId, new Date(timestamp));
        }

        /**
         * Updates the visibility on all existing editInfo entries
         * @param {!boolean} visible
         * @return {undefined}
         */
        function setEditInfoMarkerVisibility(visible) {
            var editInfoMarker,
                /**@type{string}*/
                keyname;

            for (keyname in editInfoMap) {
                if (editInfoMap.hasOwnProperty(keyname)) {
                    editInfoMarker = editInfoMap[keyname];
                    if (visible) {
                        editInfoMarker.show();
                    } else {
                        editInfoMarker.hide();
                    }
                }
            }
        }

        /**
         * Updates the visibility on all existing avatars
         * @param {!boolean} visible
         * @return {undefined}
         */
        function setCaretAvatarVisibility(visible) {
            caretManager.getCarets().forEach(function (caret) {
                if (visible) {
                    caret.showHandle();
                } else {
                    caret.hideHandle();
                }
            });
        }

        /**
         * Show edit information markers displayed near edited paragraphs
         * @return {undefined}
         */
        this.showEditInfoMarkers = function () {
            if (showEditInfoMarkers) {
                return;
            }

            showEditInfoMarkers = true;
            setEditInfoMarkerVisibility(showEditInfoMarkers);
        };

        /**
         * Hide edit information markers displayed near edited paragraphs
         * @return {undefined}
         */
        this.hideEditInfoMarkers = function () {
            if (!showEditInfoMarkers) {
                return;
            }

            showEditInfoMarkers = false;
            setEditInfoMarkerVisibility(showEditInfoMarkers);
        };

        /**
         * Show member avatars above the cursor
         * @return {undefined}
         */
        this.showCaretAvatars = function () {
            if (showCaretAvatars) {
                return;
            }

            showCaretAvatars = true;
            setCaretAvatarVisibility(showCaretAvatars);
        };

        /**
         * Hide member avatars above the cursor
         * @return {undefined}
         */
        this.hideCaretAvatars = function () {
            if (!showCaretAvatars) {
                return;
            }

            showCaretAvatars = false;
            setCaretAvatarVisibility(showCaretAvatars);
        };

        /**
         * @return {!Session}
         */
        this.getSession = function () {
            return session;
        };
        /**
         * @param {!string} memberid
         * @return {?Caret}
         */
        this.getCaret = function (memberid) {
            return caretManager.getCaret(memberid);
        };

        /**
         * @param {!Member} member
         * @return {undefined}
         */
        function renderMemberData(member) {
            var memberId = member.getMemberId(),
                properties = member.getProperties();

            setAvatarInfoStyle(memberId, properties.fullName, properties.color);
        }

        /**
         * @param {!OdtCursor} cursor
         * @return {undefined}
         */
        function onCursorAdded(cursor) {
            var memberId = cursor.getMemberId(),
                properties = session.getOdtDocument().getMember(memberId).getProperties(),
                caret;

            caretManager.registerCursor(cursor, showCaretAvatars, blinkOnRangeSelect);
            selectionViewManager.registerCursor(cursor, true);

            caret = caretManager.getCaret(memberId);
            if (caret) {
                caret.setAvatarImageUrl(properties.imageUrl);
                caret.setColor(properties.color);
            }
            runtime.log("+++ View here +++ eagerly created an Caret for '" + memberId + "'! +++");
        }

        /**
         * @param {!OdtCursor} cursor
         * @return {undefined}
         */
        function onCursorMoved(cursor) {
            var memberId = cursor.getMemberId(),
                localSelectionView = selectionViewManager.getSelectionView(localMemberId),
                shadowSelectionView = selectionViewManager.getSelectionView(ShadowCursor.ShadowCursorMemberId),
                localCaret = caretManager.getCaret(localMemberId);

            if (memberId === localMemberId) {
                // If our actual cursor moved, then hide the shadow cursor's selection
                shadowSelectionView.hide();
                if (localSelectionView) {
                    localSelectionView.show();
                }
                if (localCaret) {
                    localCaret.show();
                }
            } else if (memberId === ShadowCursor.ShadowCursorMemberId) {
                // If the shadow cursor moved, then hide the current cursor's selection
                shadowSelectionView.show();
                if (localSelectionView) {
                    localSelectionView.hide();
                }
                if (localCaret) {
                    localCaret.hide();
                }
            }
        }

        /**
         * @param {!string} memberid
         * @return {undefined}
         */
        function onCursorRemoved(memberid) {
            selectionViewManager.removeSelectionView(memberid);
        }

        /**
         * @param {!{paragraphElement:!Element,memberId:string,timeStamp:number}} info
         * @return {undefined}
         */
        function onParagraphChanged(info) {
            highlightEdit(info.paragraphElement, info.memberId, info.timeStamp);
            highlightRefreshTask.trigger();
        }

        /**
         * @return {undefined}
         */
        function refreshHighlights() {
            var annotationViewManager = odfCanvas.getAnnotationViewManager();
            if (annotationViewManager) {
                annotationViewManager.rehighlightAnnotations();
                odtDocument.fixCursorPositions();
            }
        }

        function processConstraints() {
            var localMemberName,
                cssString,
                localMember;

            // TODO: Move such handling into AnnotationViewManager
            if (annotationConstraintStyles.hasChildNodes()) {
                domUtils.removeAllChildNodes(annotationConstraintStyles);
            }

            if (sessionConstraints.getState(CommonConstraints.EDIT.ANNOTATIONS.ONLY_DELETE_OWN) === true) {
                localMember = session.getOdtDocument().getMember(localMemberId);
                if (localMember) {
                    localMemberName = localMember.getProperties().fullName;
                    cssString = ".annotationWrapper:not([creator = '" + localMemberName + "']) .annotationRemoveButton { display: none; }";
                    annotationConstraintStyles.appendChild(document.createTextNode(cssString));
                }
            }
        }

        /**
         * @param {!function(!Error=)} callback
         * @return {undefined}
         */
        function destroy(callback) {
            var /**@type{!Array.<!EditInfoMarker>}*/
                editInfoArray = Object.keys(editInfoMap).map(function (keyname) {
                    return editInfoMap[keyname];
                });

            odtDocument.unsubscribe(OpsDocument.signalMemberAdded, renderMemberData);
            odtDocument.unsubscribe(OpsDocument.signalMemberUpdated, renderMemberData);
            odtDocument.unsubscribe(OpsDocument.signalCursorAdded, onCursorAdded);
            odtDocument.unsubscribe(OpsDocument.signalCursorRemoved, onCursorRemoved);
            odtDocument.unsubscribe(OdtDocument.signalParagraphChanged, onParagraphChanged);
            odtDocument.unsubscribe(OpsDocument.signalCursorMoved, onCursorMoved);

            odtDocument.unsubscribe(OdtDocument.signalParagraphChanged, selectionViewManager.rerenderSelectionViews);
            odtDocument.unsubscribe(OdtDocument.signalTableAdded, selectionViewManager.rerenderSelectionViews);
            odtDocument.unsubscribe(OdtDocument.signalParagraphStyleModified, selectionViewManager.rerenderSelectionViews);

            sessionConstraints.unsubscribe(CommonConstraints.EDIT.ANNOTATIONS.ONLY_DELETE_OWN, processConstraints);
            odtDocument.unsubscribe(OpsDocument.signalMemberAdded, processConstraints);
            odtDocument.unsubscribe(OpsDocument.signalMemberUpdated, processConstraints);

            avatarInfoStyles.parentNode.removeChild(avatarInfoStyles);
            annotationConstraintStyles.parentNode.removeChild(annotationConstraintStyles);

            (function destroyEditInfo(i, err) {
                if (err) {
                    callback(err);
                } else {
                    if (i < editInfoArray.length) {
                        editInfoArray[i].destroy(function (err) {
                            destroyEditInfo(i + 1, err);
                        });
                    } else {
                        callback();
                    }
                }
            }(0, undefined));
        }

        /**
         * @param {!function(!Error=)} callback, passing an error object in case of error
         * @return {undefined}
         */
        this.destroy = function (callback) {
            var cleanup = [highlightRefreshTask.destroy, destroy];
            odtDocument.unsubscribe(OdtDocument.signalAnnotationAdded, onAnnotationAdded);
            async.destroyAll(cleanup, callback);
        };

        function init() {
            odtDocument = session.getOdtDocument();
            odfCanvas = odtDocument.getOdfCanvas();

            odtDocument.subscribe(OdtDocument.signalAnnotationAdded, onAnnotationAdded);
            odtDocument.subscribe(OpsDocument.signalMemberAdded, renderMemberData);
            odtDocument.subscribe(OpsDocument.signalMemberUpdated, renderMemberData);
            odtDocument.subscribe(OpsDocument.signalCursorAdded, onCursorAdded);
            odtDocument.subscribe(OpsDocument.signalCursorRemoved, onCursorRemoved);
            odtDocument.subscribe(OdtDocument.signalParagraphChanged, onParagraphChanged);
            odtDocument.subscribe(OpsDocument.signalCursorMoved, onCursorMoved);

            odtDocument.subscribe(OdtDocument.signalParagraphChanged, selectionViewManager.rerenderSelectionViews);
            odtDocument.subscribe(OdtDocument.signalTableAdded, selectionViewManager.rerenderSelectionViews);
            odtDocument.subscribe(OdtDocument.signalParagraphStyleModified, selectionViewManager.rerenderSelectionViews);

            sessionConstraints.subscribe(CommonConstraints.EDIT.ANNOTATIONS.ONLY_DELETE_OWN, processConstraints);
            odtDocument.subscribe(OpsDocument.signalMemberAdded, processConstraints);
            odtDocument.subscribe(OpsDocument.signalMemberUpdated, processConstraints);

            // Add a css sheet for user info-edited styling
            avatarInfoStyles = newStyleSheet();
            avatarInfoStyles.appendChild(document.createTextNode('@namespace editinfo url(urn:webodf:names:editinfo);'));
            avatarInfoStyles.appendChild(document.createTextNode('@namespace dc url(http://purl.org/dc/elements/1.1/);'));
            // Add a css sheet for annotation constraint styling
            annotationConstraintStyles = newStyleSheet();
            processConstraints();

            highlightRefreshTask = task.createRedrawTask(refreshHighlights);
        }
        init();
    }
/**@const*/
exports.SessionView = SessionView;
