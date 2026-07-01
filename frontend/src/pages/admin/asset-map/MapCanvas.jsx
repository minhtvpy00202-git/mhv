import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArrowsMove as Move,
  IconDeviceFloppy as Save,
  IconEdit as Edit,
  IconListDetails as ListDetails,
  IconRefresh as Refresh,
  IconTrash as Trash,
  IconX as X,
  IconZoomIn as ZoomIn,
  IconZoomOut as ZoomOut,
} from '@tabler/icons-react'
import { resolveBackendMediaUrl } from '../../../utils/mediaUrl'

const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.5

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export default function MapCanvas({
  floor,
  isActive,
  isImageFloor,
  isFloorEditing,
  selectedShapeId,
  selectedShapeIdSet,
  selectedShapes,
  selectedCells,
  editableShapeId,
  drawTool,
  floorInteractionMode,
  roomDragState,
  cellShapeMap,
  searchResultMap,
  showGridLines,
  canvasResizeState,
  roomDraft,
  imageSelection,
  imageSelectionGeometry,
  imageVertexDragState,
  imageSvgRef,
  cellSize,
  defaultColor,
  getShapePoints,
  buildImageBoundsFromPoints,
  getShapeCenter,
  getShapeBounds,
  getReadableTextColor,
  colorWithAlpha,
  pointsToSvgValue,
  getMarkerOffsets,
  visibleShapeIdSet,
  selectionBounds,
  showFloatingSelectionToolbar,
  quickSelectionColor,
  onQuickSelectionSave,
  onQuickSelectionCancel,
  onQuickSelectionDelete,
  onQuickSelectionBind,
  onQuickSelectionEditInfo,
  onQuickSelectionEditLayout,
  onQuickSelectionMove,
  onQuickSelectionOpenAssets,
  onQuickSelectionPaintMode,
  HandToolIcon,
  PaintToolIcon,
  onQuickSelectionColorChange,
  onImagePointerDown,
  onImagePointerMove,
  onImagePointerUp,
  onImageCanvasClick,
  onImageVertexPointerDown,
  onCanvasResizeStart,
  onCellPointerDown,
  onCellPointerEnter,
  onCellPointerUp,
  onRoomPointerDown,
  onRoomClick,
  onRoomPreviewShow,
  onRoomPreviewHide,
  onMarkerTooltipShow,
  onMarkerTooltipHide,
  showCanvasGrid,
  snapEnabled,
  onToggleCanvasGrid,
  onToggleSnap,
}) {
  const viewportRef = useRef(null)
  const floatingToolbarRef = useRef(null)
  const panDragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [viewportMetrics, setViewportMetrics] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  })
  const [floatingToolbarSize, setFloatingToolbarSize] = useState({
    width: 188,
    height: 220,
  })
  const [floatingToolbarDismissed, setFloatingToolbarDismissed] = useState(false)
  const [resizeHoverHandle, setResizeHoverHandle] = useState(null)

  const sceneWidth = isImageFloor ? (floor.imageWidth || 960) : (floor.gridCols * cellSize)
  const sceneHeight = isImageFloor ? (floor.imageHeight || 540) : (floor.gridRows * cellSize)

  const visibleRooms = useMemo(
    () => (floor.roomShapes || []).filter((shape) => visibleShapeIdSet.has(Number(shape.id))),
    [floor.roomShapes, visibleShapeIdSet],
  )

  const setZoomWithAnchor = useCallback((nextZoom, anchor = null) => {
    const viewport = viewportRef.current
    if (!viewport) {
      setZoom(clampZoom(nextZoom))
      return
    }

    const clampedZoom = clampZoom(nextZoom)
    const currentZoom = zoom
    const anchorX = anchor?.x ?? viewport.clientWidth / 2
    const anchorY = anchor?.y ?? viewport.clientHeight / 2
    const contentX = (viewport.scrollLeft + anchorX) / currentZoom
    const contentY = (viewport.scrollTop + anchorY) / currentZoom

    setZoom(clampedZoom)
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(contentX * clampedZoom - anchorX, 0)
      viewport.scrollTop = Math.max(contentY * clampedZoom - anchorY, 0)
    })
  }, [zoom])

  const handleFitView = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const availableWidth = Math.max(viewport.clientWidth - 24, 120)
    const availableHeight = Math.max(viewport.clientHeight - 24, 120)
    const nextZoom = clampZoom(Math.min(availableWidth / sceneWidth, availableHeight / sceneHeight))
    setZoom(nextZoom)
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max((sceneWidth * nextZoom - viewport.clientWidth) / 2, 0)
      viewport.scrollTop = Math.max((sceneHeight * nextZoom - viewport.clientHeight) / 2, 0)
    })
  }, [sceneHeight, sceneWidth])

  const handleResetView = useCallback(() => {
    const viewport = viewportRef.current
    setZoom(1)
    if (!viewport) return
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    })
  }, [])

  useEffect(() => {
    setZoom(1)
  }, [floor.id])

  useEffect(() => {
    if (!isActive) return
    const viewport = viewportRef.current
    if (!viewport) return
    if (viewport.scrollLeft === 0 && viewport.scrollTop === 0) {
      handleFitView()
    }
  }, [handleFitView, isActive])

  useEffect(() => {
    if (!isPanning) return undefined

    const handleMouseMove = (event) => {
      const viewport = viewportRef.current
      if (!viewport || !panDragRef.current.active) return
      viewport.scrollLeft = panDragRef.current.scrollLeft - (event.clientX - panDragRef.current.startX)
      viewport.scrollTop = panDragRef.current.scrollTop - (event.clientY - panDragRef.current.startY)
    }

    const stopPan = () => {
      panDragRef.current.active = false
      setIsPanning(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopPan)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopPan)
    }
  }, [isPanning])

  useEffect(() => {
    if (!showFloatingSelectionToolbar) return undefined

    const viewport = viewportRef.current
    if (!viewport) return undefined

    const syncViewportMetrics = () => {
      setViewportMetrics((previous) => {
        const nextMetrics = {
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
          width: viewport.clientWidth,
          height: viewport.clientHeight,
          left: viewport.getBoundingClientRect().left,
          top: viewport.getBoundingClientRect().top,
        }
        if (
          previous.scrollLeft === nextMetrics.scrollLeft
          && previous.scrollTop === nextMetrics.scrollTop
          && previous.width === nextMetrics.width
          && previous.height === nextMetrics.height
          && previous.left === nextMetrics.left
          && previous.top === nextMetrics.top
        ) {
          return previous
        }
        return nextMetrics
      })
    }

    syncViewportMetrics()
    viewport.addEventListener('scroll', syncViewportMetrics, { passive: true })
    window.addEventListener('resize', syncViewportMetrics)

    const viewportResizeObserver = new ResizeObserver(() => {
      syncViewportMetrics()
    })
    viewportResizeObserver.observe(viewport)

    return () => {
      viewport.removeEventListener('scroll', syncViewportMetrics)
      window.removeEventListener('resize', syncViewportMetrics)
      viewportResizeObserver.disconnect()
    }
  }, [showFloatingSelectionToolbar])

  useEffect(() => {
    if (!showFloatingSelectionToolbar) return undefined

    const toolbar = floatingToolbarRef.current
    if (!toolbar) return undefined

    const syncToolbarSize = () => {
      const bounds = toolbar.getBoundingClientRect()
      setFloatingToolbarSize((previous) => {
        const nextSize = {
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        }
        if (previous.width === nextSize.width && previous.height === nextSize.height) {
          return previous
        }
        return nextSize
      })
    }

    syncToolbarSize()

    const toolbarResizeObserver = new ResizeObserver(() => {
      syncToolbarSize()
    })
    toolbarResizeObserver.observe(toolbar)

    return () => {
      toolbarResizeObserver.disconnect()
    }
  }, [floorInteractionMode, showFloatingSelectionToolbar, selectedShapes.length])

  useEffect(() => {
    if (!showFloatingSelectionToolbar) {
      setFloatingToolbarDismissed(false)
      return
    }
    setFloatingToolbarDismissed(false)
  }, [
    drawTool,
    floorInteractionMode,
    selectionBounds?.height,
    selectionBounds?.left,
    selectionBounds?.top,
    selectionBounds?.width,
    selectedShapeId,
    selectedShapes.length,
    showFloatingSelectionToolbar,
  ])

  const isFloatingToolbarVisible = showFloatingSelectionToolbar && !floatingToolbarDismissed

  const isPointerInsideSelectionBounds = useCallback((event) => {
    if (!selectionBounds) return false
    const viewport = viewportRef.current
    if (!viewport) return false
    const viewportRect = viewport.getBoundingClientRect()
    const pointerLeft = event.clientX - viewportRect.left + viewport.scrollLeft
    const pointerTop = event.clientY - viewportRect.top + viewport.scrollTop
    const scaledLeft = selectionBounds.left * zoom
    const scaledTop = selectionBounds.top * zoom
    const scaledRight = scaledLeft + (selectionBounds.width * zoom)
    const scaledBottom = scaledTop + (selectionBounds.height * zoom)
    return (
      pointerLeft >= scaledLeft
      && pointerLeft <= scaledRight
      && pointerTop >= scaledTop
      && pointerTop <= scaledBottom
    )
  }, [selectionBounds, zoom])

  useEffect(() => {
    if (!isFloatingToolbarVisible) return undefined

    const handlePointerDownOutside = (event) => {
      const toolbar = floatingToolbarRef.current
      if (toolbar?.contains(event.target)) {
        return
      }
      if (isPointerInsideSelectionBounds(event)) {
        return
      }
      setFloatingToolbarDismissed(true)
    }

    window.addEventListener('pointerdown', handlePointerDownOutside, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true)
    }
  }, [isFloatingToolbarVisible, isPointerInsideSelectionBounds])

  const handleViewportMouseDown = useCallback((event) => {
    if (event.button !== 1 && !event.altKey) return
    const viewport = viewportRef.current
    if (!viewport) return
    event.preventDefault()
    panDragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
    setIsPanning(true)
  }, [])

  const handleViewportWheel = useCallback((event) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    const viewportRect = viewport.getBoundingClientRect()
    const anchor = {
      x: event.clientX - viewportRect.left,
      y: event.clientY - viewportRect.top,
    }
    const delta = event.deltaY < 0 ? 0.12 : -0.12
    setZoomWithAnchor(zoom + delta, anchor)
  }, [setZoomWithAnchor, zoom])

  const handleSuppressContextMenu = useCallback((event) => {
    event.preventDefault()
  }, [])

  const floatingToolbarPosition = useMemo(() => {
    if (!selectionBounds) return null
    const viewportWidth = viewportMetrics.width || sceneWidth * zoom
    const viewportHeight = viewportMetrics.height || sceneHeight * zoom
    const padding = 12
    const gap = 10
    const menuWidth = floatingToolbarSize.width || 188
    const menuHeight = floatingToolbarSize.height || 220
    const viewportLeft = viewportMetrics.left || 0
    const viewportTop = viewportMetrics.top || 0
    const anchorCenterX = viewportLeft + ((selectionBounds.left * zoom) - viewportMetrics.scrollLeft) + (selectionBounds.width * zoom / 2)
    const anchorTop = viewportTop + ((selectionBounds.top * zoom) - viewportMetrics.scrollTop)
    const anchorBottom = viewportTop + (((selectionBounds.top + selectionBounds.height) * zoom) - viewportMetrics.scrollTop)
    const visibleLeft = padding
    const visibleTop = padding
    const visibleRight = window.innerWidth - padding
    const visibleBottom = window.innerHeight - padding
    const maxLeft = Math.max(visibleLeft, visibleRight - menuWidth)
    const maxTop = Math.max(visibleTop, visibleBottom - menuHeight)

    let left = anchorCenterX - (menuWidth / 2)
    if (left < visibleLeft) {
      left = visibleLeft
    } else if (left > maxLeft) {
      left = maxLeft
    }

    let top = anchorTop - menuHeight - gap
    if (top < visibleTop) {
      top = anchorBottom + gap
    }
    if (top > maxTop) {
      top = maxTop
    }
    if (top < visibleTop) {
      top = visibleTop
    }

    return {
      left,
      top,
    }
  }, [floatingToolbarSize.height, floatingToolbarSize.width, sceneHeight, sceneWidth, selectionBounds, viewportMetrics.height, viewportMetrics.left, viewportMetrics.scrollLeft, viewportMetrics.scrollTop, viewportMetrics.top, viewportMetrics.width, zoom])

  const renderMarkers = () => visibleRooms.flatMap((shape) => {
    const center = getShapeCenter(shape)
    const assets = searchResultMap.get(shape.locationId) || []
    return assets.map((asset, index) => {
      const offset = getMarkerOffsets(index)
      return (
        <div
          key={`${shape.id}-${asset.qaCode}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: center.left + offset.x,
            top: center.top + offset.y,
          }}
        >
          <button
            type="button"
            onMouseEnter={(event) => onMarkerTooltipShow(event, asset)}
            onMouseLeave={() => onMarkerTooltipHide(asset)}
            onFocus={(event) => onMarkerTooltipShow(event, asset)}
            onBlur={() => onMarkerTooltipHide(asset)}
            className="relative h-4 w-4 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(255,255,255,0.95)]"
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full bg-red-400"
              style={{ animation: 'asset-map-ping 1.9s ease-out infinite' }}
            />
          </button>
        </div>
      )
    })
  })

  const renderFloatingToolbar = () => {
    if (!isFloatingToolbarVisible || !floatingToolbarPosition) return null
    const canManageSingleSelection = selectedShapes.length === 1
    const canPaintSingleSelection = selectedShapes.length === 1
    const canDeleteSingleSelection = selectedShapes.length === 1

    if (floorInteractionMode === 'view') {
      return (
        <div
          ref={floatingToolbarRef}
          className="fixed z-[90] flex min-w-[188px] max-w-[220px] flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left: floatingToolbarPosition.left,
            top: floatingToolbarPosition.top,
          }}
        >
          <button
            type="button"
            onClick={onQuickSelectionEditInfo}
            disabled={!canManageSingleSelection}
            className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit size={14} />
            Sửa thông tin
          </button>
          <button
            type="button"
            onClick={onQuickSelectionEditLayout}
            disabled={!canManageSingleSelection}
            className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit size={14} />
            Chỉnh lại phạm vi
          </button>
          <button
            type="button"
            onClick={onQuickSelectionOpenAssets}
            disabled={!canManageSingleSelection}
            className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ListDetails size={14} />
            Xem tài sản
          </button>
          {!isImageFloor && (
            <button
              type="button"
              onClick={onQuickSelectionMove}
              disabled={!canManageSingleSelection}
              className={`inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${
                drawTool === 'move'
                  ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:ring-sky-900/40'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <HandToolIcon size={14} />
              Di chuyển
            </button>
          )}
          <button
            type="button"
            onClick={onQuickSelectionPaintMode}
            disabled={!canPaintSingleSelection}
            className={`inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${
              drawTool === 'paint'
                ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-200 dark:ring-orange-900/40'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <PaintToolIcon size={14} />
            Tô màu
          </button>
          <label className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            <span>Màu phòng</span>
            <input
              type="color"
              value={quickSelectionColor}
              disabled={!canPaintSingleSelection}
              onChange={(event) => onQuickSelectionColorChange(event.target.value)}
              className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
            />
          </label>
          <button
            type="button"
            onClick={onQuickSelectionDelete}
            disabled={!canDeleteSingleSelection}
            className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash size={14} />
            Xóa khỏi sơ đồ
          </button>
          <button
            type="button"
            onClick={onQuickSelectionCancel}
            className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <X size={14} />
            Bỏ chọn
          </button>
        </div>
      )
    }

    return (
      <div
        ref={floatingToolbarRef}
        className="fixed z-[90] flex min-w-[188px] max-w-[220px] flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
        style={{
          left: floatingToolbarPosition.left,
          top: floatingToolbarPosition.top,
        }}
      >
        <button
          type="button"
          onClick={onQuickSelectionSave}
          className="inline-flex w-full items-center gap-2 rounded-xl bg-fptOrange px-3 py-2.5 text-left text-xs font-semibold text-white hover:bg-fptOrangeDark"
        >
          <Save size={14} />
          Lưu
        </button>
        <button
          type="button"
          onClick={onQuickSelectionBind}
          className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Save size={14} />
          Gắn phòng
        </button>
        <label className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          <span>Màu khu vực</span>
          <input
            type="color"
            value={quickSelectionColor}
            onChange={(event) => onQuickSelectionColorChange(event.target.value)}
            className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
        <button
          type="button"
          onClick={onQuickSelectionDelete}
          className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          <Trash size={14} />
          Xóa khỏi sơ đồ
        </button>
        <button
          type="button"
          onClick={onQuickSelectionCancel}
          className="inline-flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <X size={14} />
          Hủy
        </button>
      </div>
    )
  }

  const renderImageScene = () => (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700"
      style={{
        width: sceneWidth,
        height: sceneHeight,
        backgroundColor: '#FFFFFF',
      }}
    >
      {showCanvasGrid && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(15,23,42,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.12) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      )}
      {floor.backgroundImageUrl ? (
        <img
          src={resolveBackendMediaUrl(floor.backgroundImageUrl)}
          alt={floor.name}
          className="absolute inset-0 h-full w-full object-fill"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Chưa có ảnh nền cho tầng này.
        </div>
      )}

      <svg
        ref={isActive ? imageSvgRef : null}
        className={`absolute inset-0 h-full w-full ${floorInteractionMode === 'add' || floorInteractionMode === 'edit' ? 'cursor-crosshair' : 'cursor-default'}`}
        viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
        onPointerDown={(event) => onImagePointerDown(event, floor)}
        onPointerMove={(event) => onImagePointerMove(event, floor)}
        onPointerUp={(event) => onImagePointerUp(event, floor)}
        onClick={(event) => onImageCanvasClick(event, floor)}
      >
        {visibleRooms.map((shape) => {
          if (isFloorEditing && Number(shape.id) === Number(selectedShapeId)) {
            return null
          }
          const points = getShapePoints(shape)
          const bounds = buildImageBoundsFromPoints(points)
          if (points.length < 3 || !bounds) return null
          const isSelected = selectedShapeIdSet.has(Number(shape.id))
          const fill = isSelected
            ? colorWithAlpha(shape.colorHex, 0.28)
            : colorWithAlpha(shape.colorHex, 0.18)
          const stroke = isSelected ? '#f97316' : (shape.colorHex || defaultColor)
          const center = getShapeCenter(shape)

          return (
            <g key={`room-image-${shape.id}`}>
              <polygon
                points={pointsToSvgValue(points)}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 3 : 2}
                className={`${floorInteractionMode === 'view' ? 'cursor-pointer' : 'pointer-events-none'} transition`}
                onClick={floorInteractionMode === 'view' ? (event) => onRoomClick(event, floor, shape) : undefined}
                onContextMenu={handleSuppressContextMenu}
                onMouseEnter={floorInteractionMode === 'view' ? (event) => onRoomPreviewShow(event, shape) : undefined}
                onMouseLeave={floorInteractionMode === 'view' ? () => onRoomPreviewHide(shape) : undefined}
                onFocus={floorInteractionMode === 'view' ? (event) => onRoomPreviewShow(event, shape) : undefined}
                onBlur={floorInteractionMode === 'view' ? () => onRoomPreviewHide(shape) : undefined}
              />
              <text
                x={center.left}
                y={center.top}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#0f172a"
                fontSize="12"
                fontWeight="600"
                className="pointer-events-none select-none"
              >
                {shape.roomName}
              </text>
            </g>
          )
        })}

        {isActive && (floorInteractionMode === 'add' || floorInteractionMode === 'edit') && imageSelectionGeometry.bounds && (
          <g className="pointer-events-none">
            <polygon
              points={pointsToSvgValue(imageSelectionGeometry.points)}
              fill={colorWithAlpha(roomDraft.colorHex || defaultColor, 0.26)}
              stroke={roomDraft.colorHex || defaultColor}
              strokeDasharray="8 6"
              strokeWidth="3"
            />
          </g>
        )}

        {isActive && (floorInteractionMode === 'add' || floorInteractionMode === 'edit') && !imageSelection.drawing && (imageSelectionGeometry.points || []).length > 0 && (
          <g>
            {imageSelectionGeometry.points.map((point, index) => {
              const isDraggingPoint = imageVertexDragState.active && Number(imageVertexDragState.pointIndex) === index
              return (
                <circle
                  key={`image-selection-handle-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={isDraggingPoint ? 7 : 6}
                  fill="#FFFFFF"
                  stroke={roomDraft.colorHex || defaultColor}
                  strokeWidth="3"
                  className="cursor-move transition"
                  onPointerDown={(event) => onImageVertexPointerDown(event, floor, index)}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                />
              )
            })}
          </g>
        )}

        {isActive && drawTool === 'polygon' && (imageSelection.points || []).length > 0 && (
          <g className="pointer-events-none">
            <polyline
              points={pointsToSvgValue([
                ...(imageSelection.points || []),
                ...(imageSelection.hoverPoint ? [imageSelection.hoverPoint] : []),
              ])}
              fill="none"
              stroke={roomDraft.colorHex || defaultColor}
              strokeDasharray="8 6"
              strokeWidth="2.5"
            />
            {(imageSelection.points || []).map((point, index) => (
              <circle
                key={`image-point-${index}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={roomDraft.colorHex || defaultColor}
              />
            ))}
          </g>
        )}
      </svg>

      {renderMarkers()}
    </div>
  )

  const renderGridScene = () => (
    <div
      className="relative"
      style={{
        width: sceneWidth,
        height: sceneHeight,
      }}
    >
      <div
        className="absolute inset-0 rounded-xl border border-slate-300 dark:border-slate-700"
        style={{
          backgroundColor: floor.canvasBackgroundColor || '#FFFFFF',
        }}
        onContextMenu={handleSuppressContextMenu}
      />

      {showCanvasGrid && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(148,163,184,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.28) 1px, transparent 1px)`,
            backgroundSize: `${cellSize}px ${cellSize}px`,
          }}
        />
      )}

      {isActive && floorInteractionMode === 'view' && (
        <>
          <button
            type="button"
            aria-label="Kéo thay đổi chiều rộng canvas"
            onMouseDown={(event) => onCanvasResizeStart(event, floor, 'right')}
            onMouseEnter={() => setResizeHoverHandle('right')}
            onMouseLeave={() => setResizeHoverHandle((previous) => (previous === 'right' ? null : previous))}
            className="absolute right-[-6px] top-1 bottom-1 z-20 w-3 cursor-ew-resize bg-transparent"
          />
          <button
            type="button"
            aria-label="Kéo thay đổi chiều cao canvas"
            onMouseDown={(event) => onCanvasResizeStart(event, floor, 'bottom')}
            onMouseEnter={() => setResizeHoverHandle('bottom')}
            onMouseLeave={() => setResizeHoverHandle((previous) => (previous === 'bottom' ? null : previous))}
            className="absolute bottom-[-6px] left-1 right-1 z-20 h-3 cursor-ns-resize bg-transparent"
          />
          <button
            type="button"
            aria-label="Kéo thay đổi kích thước canvas"
            onMouseDown={(event) => onCanvasResizeStart(event, floor, 'corner')}
            onMouseEnter={() => setResizeHoverHandle('corner')}
            onMouseLeave={() => setResizeHoverHandle((previous) => (previous === 'corner' ? null : previous))}
            className="absolute bottom-[-8px] right-[-8px] z-30 h-4 w-4 cursor-nwse-resize bg-transparent"
          />
          <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-1 rounded-r-xl bg-sky-500/60 transition ${resizeHoverHandle === 'right' ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`pointer-events-none absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-sky-500/60 transition ${resizeHoverHandle === 'bottom' ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`pointer-events-none absolute bottom-0 right-0 h-3 w-3 rounded-tl-md bg-sky-600/80 transition ${resizeHoverHandle === 'corner' ? 'opacity-100' : 'opacity-0'}`} />
        </>
      )}

      {showGridLines && isActive && (
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${floor.gridCols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${floor.gridRows}, ${cellSize}px)`,
          }}
        >
          {Array.from({ length: floor.gridRows }).map((_, rowIndex) =>
            Array.from({ length: floor.gridCols }).map((__, colIndex) => {
              const cellKey = `${rowIndex}:${colIndex}`
              const rawShape = cellShapeMap.get(cellKey)
              const shape = Number(rawShape?.id) === editableShapeId ? null : rawShape
              const isSelected = selectedCells.has(cellKey)
              const isEditableShapeCell = Number(rawShape?.id) === Number(editableShapeId)
              return (
                <button
                  key={`${floor.id}-${cellKey}`}
                  type="button"
                  onMouseDown={(event) => onCellPointerDown(event, floor, cellKey, shape)}
                  onMouseEnter={() => onCellPointerEnter(floor, cellKey, shape)}
                  onMouseUp={onCellPointerUp}
                  onDragStart={(event) => event.preventDefault()}
                  className={`relative border transition ${
                    drawTool === 'select' && !shape ? 'hover:bg-orange-50 dark:hover:bg-orange-500/10' : ''
                  } ${isSelected ? 'ring-2 ring-inset ring-fptOrange' : ''}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderColor: showCanvasGrid ? undefined : 'transparent',
                    backgroundColor: isSelected
                      ? colorWithAlpha(
                        isEditableShapeCell
                          ? (roomDraft.colorHex || rawShape?.colorHex || defaultColor)
                          : (roomDraft.colorHex || defaultColor),
                        0.28,
                      )
                      : shape && visibleShapeIdSet.has(Number(shape.id))
                        ? colorWithAlpha(shape.colorHex, 0.18)
                        : undefined,
                    cursor: drawTool === 'move'
                      ? (isSelected ? 'grab' : 'not-allowed')
                      : drawTool === 'paint'
                        ? 'cell'
                        : 'crosshair',
                  }}
                />
              )
            }),
          )}
        </div>
      )}

      {visibleRooms.map((shape) => {
        if (isFloorEditing && Number(shape.id) === Number(selectedShapeId)) {
          return null
        }

        const bounds = getShapeBounds(shape)
        const isSelected = selectedShapeIdSet.has(Number(shape.id))
        const roomBackgroundColor = isSelected
          ? colorWithAlpha(shape.colorHex, 0.28)
          : (shape.colorHex || defaultColor)
        const roomTextColor = isSelected ? '#0f172a' : getReadableTextColor(shape.colorHex)

        return (
          <button
            key={`room-${shape.id}`}
            type="button"
            onMouseDown={(event) => onRoomPointerDown(event, floor, shape)}
            onClick={(event) => onRoomClick(event, floor, shape)}
            onContextMenu={handleSuppressContextMenu}
            onMouseEnter={(event) => onRoomPreviewShow(event, shape)}
            onMouseLeave={() => onRoomPreviewHide(shape)}
            onFocus={(event) => onRoomPreviewShow(event, shape)}
            onBlur={() => onRoomPreviewHide(shape)}
            className={`absolute flex items-center justify-center rounded-xl border text-center shadow-sm transition ${
              isSelected
                ? 'border-orange-400 ring-2 ring-orange-200 dark:ring-orange-500/20'
                : 'border-slate-300 hover:brightness-95 dark:border-slate-700'
            }`}
            style={{
              top: bounds.top,
              left: bounds.left,
              width: bounds.width,
              height: bounds.height,
              backgroundColor: roomBackgroundColor,
              color: roomTextColor,
              cursor: drawTool === 'move' && floorInteractionMode === 'view'
                ? (roomDragState.active && roomDragState.shapeIds.some((shapeId) => Number(shapeId) === Number(shape.id)) ? 'grabbing' : 'grab')
                : drawTool === 'paint' && floorInteractionMode === 'view'
                  ? 'cell'
                  : 'pointer',
            }}
          >
            <div className="pointer-events-none px-2">
              <span className="line-clamp-2 text-xs font-semibold">
                {shape.roomName}
              </span>
            </div>
          </button>
        )
      })}

      {renderMarkers()}
    </div>
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomWithAnchor(zoom - 0.1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ZoomOut size={14} />
            Zoom -
          </button>
          <button
            type="button"
            onClick={() => setZoomWithAnchor(zoom + 0.1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ZoomIn size={14} />
            Zoom +
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Refresh size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={handleFitView}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            <Move size={14} />
            Vừa khung
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onToggleCanvasGrid}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              showCanvasGrid
                ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={onToggleSnap}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              snapEnabled
                ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            Snap
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onWheel={handleViewportWheel}
        onMouseDown={handleViewportMouseDown}
        onContextMenu={handleSuppressContextMenu}
        className={`relative max-h-[75vh] min-h-[420px] overflow-auto rounded-2xl ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="relative"
          style={{
            width: sceneWidth * zoom,
            height: sceneHeight * zoom,
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: sceneWidth,
              height: sceneHeight,
              transform: `scale(${zoom})`,
            }}
          >
            {isImageFloor ? renderImageScene() : renderGridScene()}
          </div>
          {renderFloatingToolbar()}
        </div>
      </div>
    </div>
  )
}
