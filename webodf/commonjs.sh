#! /usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

COMPILER=~/bin/closure-compiler-v20160911.jar

java -jar "$COMPILER" \
    --process_common_js_modules \
    --extra_annotation_name licstart \
    --extra_annotation_name licend \
    --extra_annotation_name source \
    --language_in ES3 \
    --language_out ES3 \
    --env CUSTOM \
    --externs tools/externs/w3c_dom1.js \
    --externs tools/externs/w3c_dom2.js \
    --externs tools/externs/w3c_dom3.js \
    --externs tools/externs/w3c_elementtraversal.js \
    --externs tools/externs/w3c_anim_timing.js \
    --externs tools/externs/w3c_range.js \
    --externs tools/externs/w3c_xml.js \
    --externs tools/externs/w3c_css.js \
    --externs tools/externs/w3c_event.js \
    --externs tools/externs/window.js \
    --externs tools/externs/gecko_xml.js \
    --externs tools/externs/gecko_dom.js \
    --externs tools/externs/ie_dom.js \
    --externs tools/externs/gecko_event.js \
    --externs tools/externs/ie_event.js \
    --externs tools/externs/html5.js \
    --externs tools/externs/iphone.js \
    --externs tools/externs/fileapi.js \
    --externs externs/JSZip.js \
    --externs tools/externs.js \
    --dependency_mode LOOSE \
    --formatting PRETTY_PRINT \
    --js_output_file out.js \
    --jscomp_error accessControls \
    --jscomp_error ambiguousFunctionDecl \
    --jscomp_error checkEventfulObjectDisposal \
    --jscomp_error checkRegExp \
    --jscomp_error checkTypes \
    --jscomp_error checkVars \
    --jscomp_error conformanceViolations \
    --jscomp_error const \
    --jscomp_error constantProperty \
    --jscomp_error deprecated \
    --jscomp_error deprecatedAnnotations \
    --jscomp_error duplicateMessage \
    --jscomp_error es3 \
    --jscomp_error es5Strict \
    --jscomp_error externsValidation \
    --jscomp_error fileoverviewTags \
    --jscomp_error globalThis \
    --jscomp_error inferredConstCheck \
    --jscomp_error internetExplorerChecks \
    --jscomp_error invalidCasts \
    --jscomp_error misplacedTypeAnnotation \
    --jscomp_error missingGetCssName \
    --jscomp_error missingProperties \
    --jscomp_error missingRequire \
    --jscomp_error missingReturn \
    --jscomp_error msgDescriptions \
    --jscomp_error newCheckTypes \
    --jscomp_error nonStandardJsDocs \
    --jscomp_error strictModuleDepCheck \
    --jscomp_error suspiciousCode \
    --jscomp_error typeInvalidation \
    --jscomp_error undefinedNames \
    --jscomp_error undefinedVars \
    --jscomp_error underscore \
    --jscomp_error unknownDefines \
    --jscomp_error unnecessaryCasts \
    --jscomp_error unusedLocalVariables \
    --jscomp_error unusedPrivateMembers \
    --jscomp_error useOfGoogBase \
    --jscomp_error uselessCode \
    --jscomp_error visibility \
    --output_manifest manifest.MF \
    --output_module_dependencies deps.json \
    webodfversion.js.in \
    lib/runtime.js \
    lib/core/Async.js \
    lib/core/Base64.js \
    lib/core/CSSUnits.js \
    lib/core/Cursor.js \
    lib/core/Destroyable.js \
    lib/core/DomUtils.js \
    lib/core/EventNotifier.js \
    lib/core/EventSource.js \
    lib/core/EventSubscriptions.js \
    lib/core/LazyProperty.js \
    lib/core/LoopWatchDog.js \
    lib/core/NodeFilterChain.js \
    lib/core/PositionFilter.js \
    lib/core/PositionFilterChain.js \
    lib/core/PositionIterator.js \
    lib/core/ScheduledTask.js \
    lib/core/StepIterator.js \
    lib/core/Task.js \
    lib/core/Utils.js \
    lib/core/Zip.js \
    lib/core/enums.js \
    lib/core/typedefs.js \
    lib/gui/AnnotationController.js \
    lib/gui/AnnotationViewManager.js \
    lib/gui/Avatar.js \
    lib/gui/BlacklistNamespaceNodeFilter.js \
    lib/gui/Caret.js \
    lib/gui/CaretManager.js \
    lib/gui/Clipboard.js \
    lib/gui/ClosestXOffsetScanner.js \
    lib/gui/CommonConstraints.js \
    lib/gui/DirectFormattingController.js \
    lib/gui/EditInfoHandle.js \
    lib/gui/EditInfoMarker.js \
    lib/gui/EventManager.js \
    lib/gui/GuiStepUtils.js \
    lib/gui/HyperlinkClickHandler.js \
    lib/gui/HyperlinkController.js \
    lib/gui/HyperlinkTooltipView.js \
    lib/gui/IOSSafariSupport.js \
    lib/gui/ImageController.js \
    lib/gui/ImageSelector.js \
    lib/gui/InputMethodEditor.js \
    lib/gui/KeyboardHandler.js \
    lib/gui/LineBoundaryScanner.js \
    lib/gui/MetadataController.js \
    lib/gui/MimeDataExporter.js \
    lib/gui/OdfFieldView.js \
    lib/gui/OdfTextBodyNodeFilter.js \
    lib/gui/ParagraphBoundaryScanner.js \
    lib/gui/PasteController.js \
    lib/gui/SelectionController.js \
    lib/gui/SelectionView.js \
    lib/gui/SelectionViewManager.js \
    lib/gui/SessionConstraints.js \
    lib/gui/SessionContext.js \
    lib/gui/SessionController.js \
    lib/gui/SessionView.js \
    lib/gui/ShadowCursor.js \
    lib/gui/SingleScrollViewport.js \
    lib/gui/StyleSummary.js \
    lib/gui/SvgSelectionView.js \
    lib/gui/TextController.js \
    lib/gui/TrivialUndoManager.js \
    lib/gui/UndoManager.js \
    lib/gui/UndoStateRules.js \
    lib/gui/Viewport.js \
    lib/gui/VisualStepScanner.js \
    lib/gui/ZoomHelper.js \
    lib/odf/CollapsingRules.js \
    lib/odf/FontLoader.js \
    lib/odf/Formatting.js \
    lib/odf/GraphicProperties.js \
    lib/odf/ListStylesToCss.js \
    lib/odf/Namespaces.js \
    lib/odf/ObjectNameGenerator.js \
    lib/odf/OdfCanvas.js \
    lib/odf/OdfContainer.js \
    lib/odf/OdfNodeFilter.js \
    lib/odf/OdfSchema.js \
    lib/odf/OdfUtils.js \
    lib/odf/PageLayoutProperties.js \
    lib/odf/ParagraphProperties.js \
    lib/odf/StepUtils.js \
    lib/odf/Style2CSS.js \
    lib/odf/StyleCache.js \
    lib/odf/StyleInfo.js \
    lib/odf/StyleParseUtils.js \
    lib/odf/StyleTree.js \
    lib/odf/TextProperties.js \
    lib/odf/TextSerializer.js \
    lib/odf/TextStyleApplicator.js \
    lib/odf/WordBoundaryFilter.js \
    lib/ops/Canvas.js \
    lib/ops/Document.js \
    lib/ops/EditInfo.js \
    lib/ops/Member.js \
    lib/ops/OdtCursor.js \
    lib/ops/OdtDocument.js \
    lib/ops/OdtStepsTranslator.js \
    lib/ops/OpAddAnnotation.js \
    lib/ops/OpAddCursor.js \
    lib/ops/OpAddMember.js \
    lib/ops/OpAddStyle.js \
    lib/ops/OpApplyDirectStyling.js \
    lib/ops/OpApplyHyperlink.js \
    lib/ops/OpInsertImage.js \
    lib/ops/OpInsertTable.js \
    lib/ops/OpInsertText.js \
    lib/ops/OpMergeParagraph.js \
    lib/ops/OpMoveCursor.js \
    lib/ops/OpRemoveAnnotation.js \
    lib/ops/OpRemoveBlob.js \
    lib/ops/OpRemoveCursor.js \
    lib/ops/OpRemoveHyperlink.js \
    lib/ops/OpRemoveMember.js \
    lib/ops/OpRemoveStyle.js \
    lib/ops/OpRemoveText.js \
    lib/ops/OpSetBlob.js \
    lib/ops/OpSetParagraphStyle.js \
    lib/ops/OpSplitParagraph.js \
    lib/ops/OpUpdateMember.js \
    lib/ops/OpUpdateMetadata.js \
    lib/ops/OpUpdateParagraphStyle.js \
    lib/ops/Operation.js \
    lib/ops/OperationFactory.js \
    lib/ops/OperationRouter.js \
    lib/ops/OperationTransformMatrix.js \
    lib/ops/OperationTransformer.js \
    lib/ops/Session.js \
    lib/ops/StepsCache.js \
    lib/ops/TextPositionFilter.js \
    lib/ops/TrivialOperationRouter.js \
    lib/xmldom/LSSerializer.js \
    lib/xmldom/LSSerializerFilter.js \
    lib/xmldom/XPath.js \

exit
    --jscomp_error reportUnknownTypes \
