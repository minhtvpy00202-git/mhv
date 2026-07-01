import {
  IconChevronDown as ChevronDown,
  IconInfoCircle as InfoCircle,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconUpload as Upload,
} from '@tabler/icons-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBeforeUnload, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'
import SearchableSelect from '../../components/ui/SearchableSelect'
import useDebouncedEffect from '../../hooks/useDebouncedEffect'
import AssetPlacementPanel from './asset-map/AssetPlacementPanel'
import {
  AREA_TYPE_PRESETS,
  buildAreaTypeOptions,
  buildAreaTypePayload,
  normalizeAreaTypeLabel,
  resolveAreaTypeDraft,
  resolveAreaTypeMeta,
} from './asset-map/areaTypes'
import FloorToolbar from './asset-map/FloorToolbar'
import ImportSessionPanel from './asset-map/ImportSessionPanel'
import MapCanvas from './asset-map/MapCanvas'
import RoomEditorModal from './asset-map/RoomEditorModal'

const CELL_SIZE = 32
const DEFAULT_COLOR = '#F97316'
const CANVAS_COLOR_DISTANCE_THRESHOLD = 52
const scannerElementId = 'asset-map-qr-scanner'
const DEFAULT_DRAW_TOOL = 'select'
const IMAGE_RECTANGLE_TOOL = 'rectangle'
const IMAGE_POLYGON_TOOL = 'polygon'

function createDefaultFloorForm() {
  return {
    name: '',
    mode: 'GRID',
    gridRows: 12,
    gridCols: 20,
  }
}

function createDefaultCanvasForm() {
  return {
    gridRows: 12,
    gridCols: 20,
    canvasBackgroundColor: '#FFFFFF',
  }
}

function createDefaultRoomDraft() {
  return {
    mode: 'new',
    locationId: '',
    roomName: '',
    colorHex: DEFAULT_COLOR,
    areaTypeKey: '',
    areaTypeLabel: '',
    areaGroupKey: '',
    areaGroupLabel: '',
  }
}

function createDefaultImageImportState() {
  return {
    sessionId: '',
    sourceFileName: '',
    sourceFileType: '',
    drawings: [],
  }
}

function createDefaultImageSelection() {
  return {
    points: [],
    bounds: null,
    drawing: false,
    startPoint: null,
    hoverPoint: null,
  }
}

function createDefaultImageVertexDragState() {
  return {
    active: false,
    floorId: null,
    pointIndex: null,
    rectangleAnchorPoint: null,
  }
}

function extractQaCode(decodedText) {
  try {
    const parsed = JSON.parse(decodedText)
    if (parsed?.qa_code) {
      return String(parsed.qa_code).trim()
    }
  } catch {
    return decodedText.trim()
  }
  return decodedText.trim()
}

function colorWithAlpha(hex, alpha) {
  const normalized = String(hex || DEFAULT_COLOR).replace('#', '')
  if (normalized.length !== 6) return `rgba(249, 115, 22, ${alpha})`
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getReadableTextColor(hex) {
  const normalized = String(hex || DEFAULT_COLOR).replace('#', '')
  if (normalized.length !== 6) return '#0f172a'
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.62 ? '#0f172a' : '#ffffff'
}

function normalizeHexColor(hex, fallback = DEFAULT_COLOR) {
  const normalized = String(hex || '').trim().replace('#', '')
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toUpperCase()}`
  }
  return fallback
}

function parseHexColor(hex, fallback = DEFAULT_COLOR) {
  const normalized = normalizeHexColor(hex, fallback).replace('#', '')
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function getColorDistance(firstHex, secondHex) {
  const first = parseHexColor(firstHex)
  const second = parseHexColor(secondHex)
  return Math.sqrt(
    ((first.red - second.red) ** 2)
    + ((first.green - second.green) ** 2)
    + ((first.blue - second.blue) ** 2),
  )
}

function findCanvasColorConflict(roomShapes, nextCanvasColor) {
  const normalizedCanvasColor = normalizeHexColor(nextCanvasColor, '#FFFFFF')
  return (roomShapes || []).reduce((closestConflict, shape) => {
    const roomColor = normalizeHexColor(shape?.colorHex, DEFAULT_COLOR)
    const distance = getColorDistance(normalizedCanvasColor, roomColor)
    if (distance > CANVAS_COLOR_DISTANCE_THRESHOLD) {
      return closestConflict
    }
    if (!closestConflict || distance < closestConflict.distance) {
      return {
        shape,
        colorHex: roomColor,
        distance,
      }
    }
    return closestConflict
  }, null)
}

function parseCell(cell) {
  const [row, col] = String(cell || '0:0').split(':').map((value) => Number(value))
  return {
    row: Number.isFinite(row) ? row : 0,
    col: Number.isFinite(col) ? col : 0,
  }
}

function compareCells(left, right) {
  const leftCell = parseCell(left)
  const rightCell = parseCell(right)
  if (leftCell.row !== rightCell.row) return leftCell.row - rightCell.row
  return leftCell.col - rightCell.col
}

function getShapeCenter(shape) {
  const points = Array.isArray(shape?.points) ? shape.points : []
  if (points.length > 0) {
    const total = points.reduce(
      (accumulator, point) => ({
        x: accumulator.x + (Number(point?.x) || 0),
        y: accumulator.y + (Number(point?.y) || 0),
      }),
      { x: 0, y: 0 },
    )
    return {
      left: total.x / points.length,
      top: total.y / points.length,
    }
  }

  const cells = Array.isArray(shape?.cells) ? shape.cells.map(parseCell) : []
  if (cells.length > 0) {
    const total = cells.reduce(
      (accumulator, cell) => ({
        row: accumulator.row + cell.row,
        col: accumulator.col + cell.col,
      }),
      { row: 0, col: 0 },
    )
    const averageRow = total.row / cells.length
    const averageCol = total.col / cells.length
    return {
      left: averageCol * CELL_SIZE + CELL_SIZE / 2,
      top: averageRow * CELL_SIZE + CELL_SIZE / 2,
    }
  }

  const bounds = shape?.bounds
  if (bounds && Number.isFinite(bounds.minX) && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxY)) {
    return {
      left: (bounds.minX + bounds.maxX) / 2,
      top: (bounds.minY + bounds.maxY) / 2,
    }
  }

  return {
    left: CELL_SIZE / 2,
    top: CELL_SIZE / 2,
  }
}

function getShapeBounds(shape) {
  const cells = Array.isArray(shape?.cells) ? shape.cells.map(parseCell) : []
  if (cells.length === 0) {
    return {
      minRow: 0,
      maxRow: 0,
      minCol: 0,
      maxCol: 0,
      top: 0,
      left: 0,
      width: CELL_SIZE,
      height: CELL_SIZE,
    }
  }

  const rows = cells.map((cell) => cell.row)
  const cols = cells.map((cell) => cell.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    top: minRow * CELL_SIZE,
    left: minCol * CELL_SIZE,
    width: (maxCol - minCol + 1) * CELL_SIZE,
    height: (maxRow - minRow + 1) * CELL_SIZE,
  }
}

function getMarkerOffsets(index) {
  const offsets = [
    { x: 0, y: 0 },
    { x: -14, y: -12 },
    { x: 14, y: -10 },
    { x: -16, y: 12 },
    { x: 16, y: 12 },
    { x: 0, y: -18 },
    { x: 0, y: 18 },
    { x: -22, y: 0 },
    { x: 22, y: 0 },
  ]
  return offsets[index % offsets.length]
}

function buildCellRectangle(startCell, endCell) {
  const start = parseCell(startCell)
  const end = parseCell(endCell)
  const minRow = Math.min(start.row, end.row)
  const maxRow = Math.max(start.row, end.row)
  const minCol = Math.min(start.col, end.col)
  const maxCol = Math.max(start.col, end.col)
  const cells = []

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      cells.push(`${row}:${col}`)
    }
  }

  return cells
}

function shiftCells(cells, rowOffset, colOffset) {
  return (cells || []).map((cell) => {
    const parsed = parseCell(cell)
    return `${parsed.row + rowOffset}:${parsed.col + colOffset}`
  })
}

function areCellsInsideFloor(cells, floor) {
  if (!floor) return false
  return (cells || []).every((cell) => {
    const parsed = parseCell(cell)
    return parsed.row >= 0 && parsed.col >= 0 && parsed.row < floor.gridRows && parsed.col < floor.gridCols
  })
}

function hasCellCollision(cells, floor, ignoredShapeId = null) {
  if (!floor) return true
  return (floor.roomShapes || []).some((shape) => {
    if (ignoredShapeId && Number(shape.id) === Number(ignoredShapeId)) return false
    const occupied = new Set(shape.cells || [])
    return (cells || []).some((cell) => occupied.has(cell))
  })
}

function getRequiredCanvasSize(roomShapes) {
  let gridRows = 1
  let gridCols = 1

  ;(roomShapes || []).forEach((shape) => {
    ;(shape.cells || []).forEach((cell) => {
      const parsed = parseCell(cell)
      gridRows = Math.max(gridRows, parsed.row + 1)
      gridCols = Math.max(gridCols, parsed.col + 1)
    })
  })

  return { gridRows, gridCols }
}

function calculateFloatingCardPosition(targetRect, options = {}) {
  const tooltipWidth = options.width || 224
  const tooltipHeight = options.height || 108
  const viewportPadding = 12
  const offset = options.offset || 10
  const centeredLeft = targetRect.left + targetRect.width / 2
  const canShowAbove = targetRect.top >= tooltipHeight + offset + 10

  let left = centeredLeft
  let top = canShowAbove ? targetRect.top - offset : targetRect.bottom + offset

  const minLeft = viewportPadding + tooltipWidth / 2
  const maxLeft = window.innerWidth - viewportPadding - tooltipWidth / 2
  left = Math.min(Math.max(left, minLeft), maxLeft)

  if (!canShowAbove) {
    const maxTop = window.innerHeight - tooltipHeight - viewportPadding
    top = Math.min(top, maxTop)
  }

  return {
    left,
    top,
    placement: canShowAbove ? 'top' : 'bottom',
  }
}

function buildRoomDraftSignature(draft) {
  return JSON.stringify({
    mode: draft?.mode || 'new',
    locationId: String(draft?.locationId || ''),
    roomName: String(draft?.roomName || '').trim(),
    colorHex: String(draft?.colorHex || DEFAULT_COLOR).toUpperCase(),
    areaTypeKey: String(draft?.areaTypeKey || ''),
    areaTypeLabel: normalizeAreaTypeLabel(draft?.areaTypeLabel || ''),
    areaGroupKey: String(draft?.areaGroupKey || ''),
    areaGroupLabel: normalizeAreaTypeLabel(draft?.areaGroupLabel || ''),
  })
}

function buildFloorFormSignature(form) {
  return JSON.stringify({
    name: String(form?.name || '').trim(),
    mode: String(form?.mode || 'GRID').toUpperCase(),
    gridRows: Number(form?.gridRows) || 12,
    gridCols: Number(form?.gridCols) || 20,
  })
}

function buildCanvasFormSignature(form) {
  return JSON.stringify({
    gridRows: Number(form?.gridRows) || 12,
    gridCols: Number(form?.gridCols) || 20,
    canvasBackgroundColor: String(form?.canvasBackgroundColor || '#FFFFFF').toUpperCase(),
  })
}

function getRoomSyncMeta(shape, locations) {
  if (!shape?.locationId) {
    return {
      key: 'draft',
      label: 'Chưa gắn phòng',
      tone: 'bg-amber-100 text-amber-700 border-amber-200',
    }
  }

  const matchedLocation = (locations || []).find((item) => Number(item.id) === Number(shape.locationId))
  if (!matchedLocation) {
    return {
      key: 'missing',
      label: 'Liên kết thiếu',
      tone: 'bg-rose-100 text-rose-700 border-rose-200',
    }
  }

  return {
    key: 'synced',
    label: 'Đã đồng bộ',
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
}

function buildSelectedCellsBounds(selectedCells, cellSize) {
  if (!selectedCells || selectedCells.size === 0) return null
  const parsedCells = Array.from(selectedCells).map(parseCell)
  const rows = parsedCells.map((cell) => cell.row)
  const cols = parsedCells.map((cell) => cell.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  return {
    left: minCol * cellSize,
    top: minRow * cellSize,
    width: (maxCol - minCol + 1) * cellSize,
    height: (maxRow - minRow + 1) * cellSize,
  }
}

function serializeRoomShapes(roomShapes) {
  return (roomShapes || []).map((shape) => ({
    id: Number(shape.id) > 0 ? shape.id : null,
    locationId: shape.locationId || null,
    roomName: shape.roomName || '',
    cells: [...(shape.cells || [])].sort(compareCells),
    points: (shape.points || []).map((point) => ({
      x: Number(point?.x) || 0,
      y: Number(point?.y) || 0,
    })),
    bounds: shape.bounds
      ? {
        minX: Number(shape.bounds.minX) || 0,
        minY: Number(shape.bounds.minY) || 0,
        maxX: Number(shape.bounds.maxX) || 0,
        maxY: Number(shape.bounds.maxY) || 0,
      }
      : null,
    colorHex: shape.colorHex || DEFAULT_COLOR,
    areaTypeKey: shape.areaTypeKey || '',
    areaTypeLabel: normalizeAreaTypeLabel(shape.areaTypeLabel || ''),
  }))
}

function isImageFloorMode(floor) {
  return String(floor?.mode || 'GRID').toUpperCase() === 'IMAGE'
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function snapCanvasPoint(point, floor, enabled) {
  if (!enabled) return point
  const width = floor?.imageWidth || 0
  const height = floor?.imageHeight || 0
  const step = 12
  return {
    x: clampNumber(Math.round(point.x / step) * step, 0, width || point.x),
    y: clampNumber(Math.round(point.y / step) * step, 0, height || point.y),
  }
}

function buildImageBoundsFromPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return null
  const normalized = points
    .map((point) => ({
      x: Number(point?.x),
      y: Number(point?.y),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (normalized.length === 0) return null
  return {
    minX: Math.min(...normalized.map((point) => point.x)),
    minY: Math.min(...normalized.map((point) => point.y)),
    maxX: Math.max(...normalized.map((point) => point.x)),
    maxY: Math.max(...normalized.map((point) => point.y)),
  }
}

function buildRectanglePoints(startPoint, endPoint) {
  if (!startPoint || !endPoint) return []
  const minX = Math.min(Number(startPoint.x) || 0, Number(endPoint.x) || 0)
  const maxX = Math.max(Number(startPoint.x) || 0, Number(endPoint.x) || 0)
  const minY = Math.min(Number(startPoint.y) || 0, Number(endPoint.y) || 0)
  const maxY = Math.max(Number(startPoint.y) || 0, Number(endPoint.y) || 0)
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

function getOppositeRectanglePointIndex(pointIndex) {
  const normalizedIndex = Number(pointIndex)
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex > 3) {
    return null
  }
  return (normalizedIndex + 2) % 4
}

function getShapePoints(shape) {
  const points = (shape?.points || [])
    .map((point) => ({
      x: Number(point?.x),
      y: Number(point?.y),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (points.length >= 3) {
    return points
  }
  const bounds = shape?.bounds
  if (!bounds) return []
  return buildRectanglePoints(
    { x: Number(bounds.minX) || 0, y: Number(bounds.minY) || 0 },
    { x: Number(bounds.maxX) || 0, y: Number(bounds.maxY) || 0 },
  )
}

function pointsToSvgValue(points) {
  return (points || []).map((point) => `${point.x},${point.y}`).join(' ')
}

function MouseToolIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3.5v11.5l3.2-2.4 2.3 5.4 2.8-1.2-2.4-5.4H18L7 3.5Z" />
    </svg>
  )
}

function HandToolIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 11.5V6.5a1.5 1.5 0 0 1 3 0v4" />
      <path d="M10.5 10.5V5a1.5 1.5 0 0 1 3 0v5.5" />
      <path d="M13.5 11V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M7.5 12.5 6 11a1.5 1.5 0 0 0-2.1 2.1l3.8 3.8A5 5 0 0 0 11.2 18H15a4.5 4.5 0 0 0 4.5-4.5V10a1.5 1.5 0 0 0-3 0" />
    </svg>
  )
}

function PaintToolIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4 20 9.5l-8.8 8.8a3 3 0 0 1-4.2 0l-1.3-1.3a3 3 0 0 1 0-4.2L14.5 4Z" />
      <path d="M12 6.5 17.5 12" />
      <path d="M6 20c0-1.7 1.3-3 3-3h1c1.1 0 2 .9 2 2 0 1.7-1.3 3-3 3H8a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

function AssetMapManagement() {
  const scannerRef = useRef(null)
  const isScanningRef = useRef(false)
  const pendingNavigationRef = useRef(null)
  const pendingActionRef = useRef(null)
  const bypassLeaveGuardRef = useRef(false)
  const confirmActionRef = useRef(null)
  const imageSvgRef = useRef(null)
  const historyStateRef = useRef({ past: [], future: [], lastSignature: null })
  const historyRestoreRef = useRef(false)
  const roomModalInitialRef = useRef(buildRoomDraftSignature(createDefaultRoomDraft()))
  const floorModalInitialRef = useRef(buildFloorFormSignature(createDefaultFloorForm()))
  const canvasModalInitialRef = useRef(buildCanvasFormSignature(createDefaultCanvasForm()))
  const [loading, setLoading] = useState(true)
  const [floors, setFloors] = useState([])
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])
  const [areaTypes, setAreaTypes] = useState([])
  const [roomAssetIndex, setRoomAssetIndex] = useState([])
  const [activeFloorId, setActiveFloorId] = useState(null)
  const [selectedCells, setSelectedCells] = useState(new Set())
  const [selectedShapeId, setSelectedShapeId] = useState(null)
  const [selectedShapeIds, setSelectedShapeIds] = useState([])
  const [dirtyFloorIds, setDirtyFloorIds] = useState(new Set())
  const [dragSelection, setDragSelection] = useState({
    active: false,
    floorId: null,
    startCell: null,
    baseSelection: new Set(),
    selectionMode: 'add',
  })
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [savingFloor, setSavingFloor] = useState(false)
  const [showImageImportModal, setShowImageImportModal] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importApplying, setImportApplying] = useState(false)
  const [imageImportSession, setImageImportSession] = useState(createDefaultImageImportState)
  const [selectedImportDrawingIds, setSelectedImportDrawingIds] = useState([])
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [editingFloorId, setEditingFloorId] = useState(null)
  const [floorForm, setFloorForm] = useState(createDefaultFloorForm)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [canvasModalMode, setCanvasModalMode] = useState('color')
  const [canvasForm, setCanvasForm] = useState(createDefaultCanvasForm)
  const [showCanvasGrid, setShowCanvasGrid] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [canvasResizeState, setCanvasResizeState] = useState({
    enabled: false,
    floorId: null,
    handle: null,
    startX: 0,
    startY: 0,
    startRows: 0,
    startCols: 0,
    requiredRows: 1,
    requiredCols: 1,
  })
  const [floorInteractionMode, setFloorInteractionMode] = useState('view')
  const [drawTool, setDrawTool] = useState(DEFAULT_DRAW_TOOL)
  const [selectionEnabled, setSelectionEnabled] = useState(false)
  const [selectionMoveState, setSelectionMoveState] = useState({
    active: false,
    floorId: null,
    startCell: null,
    sourceCells: [],
  })
  const [roomDragState, setRoomDragState] = useState({
    active: false,
    floorId: null,
    shapeIds: [],
    startX: 0,
    startY: 0,
    sourceShapes: [],
  })
  const [nextTempShapeId, setNextTempShapeId] = useState(-1)
  const [imageSelection, setImageSelection] = useState(createDefaultImageSelection)
  const [imageVertexDragState, setImageVertexDragState] = useState(createDefaultImageVertexDragState)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [roomDraft, setRoomDraft] = useState(createDefaultRoomDraft)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    categoryId: '',
    floorId: '',
    locationId: '',
  })
  const [scannerOpen, setScannerOpen] = useState(false)
  const [showLeavePrompt, setShowLeavePrompt] = useState(false)
  const [leaveActionBusy, setLeaveActionBusy] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Đồng ý',
    cancelLabel: 'Hủy',
    tone: 'danger',
    busy: false,
  })
  const [roomContextMenu, setRoomContextMenu] = useState(null)
  const [canvasContextMenu, setCanvasContextMenu] = useState(null)
  const [showRoomAssetsModal, setShowRoomAssetsModal] = useState(false)
  const [showAssetSearchModal, setShowAssetSearchModal] = useState(false)
  const [roomAssetsLoading, setRoomAssetsLoading] = useState(false)
  const [roomAssets, setRoomAssets] = useState([])
  const [markerTooltip, setMarkerTooltip] = useState(null)
  const [roomPreview, setRoomPreview] = useState(null)
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false })
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const activeFloor = useMemo(
    () => floors.find((floor) => Number(floor.id) === Number(activeFloorId)) || null,
    [floors, activeFloorId],
  )

  const cellShapeMaps = useMemo(() => {
    const next = {}
    floors.forEach((floor) => {
      const map = new Map()
      ;(floor.roomShapes || []).forEach((shape) => {
        ;(shape.cells || []).forEach((cell) => {
          map.set(cell, shape)
        })
      })
      next[floor.id] = map
    })
    return next
  }, [floors])

  const selectedShape = useMemo(
    () => activeFloor?.roomShapes?.find((shape) => Number(shape.id) === Number(selectedShapeId)) || null,
    [activeFloor, selectedShapeId],
  )

  const selectedShapeIdSet = useMemo(
    () => new Set((selectedShapeIds || []).map((value) => Number(value))),
    [selectedShapeIds],
  )

  const selectedShapes = useMemo(
    () => (activeFloor?.roomShapes || []).filter((shape) => selectedShapeIdSet.has(Number(shape.id))),
    [activeFloor, selectedShapeIdSet],
  )

  const currentPaintColor = useMemo(
    () => roomDraft.colorHex || selectedShape?.colorHex || DEFAULT_COLOR,
    [roomDraft.colorHex, selectedShape?.colorHex],
  )

  const showGridLines = floorInteractionMode === 'add' || floorInteractionMode === 'edit'

  const editableShapeId = floorInteractionMode === 'edit' ? Number(selectedShapeId) : null

  const imageSelectionGeometry = useMemo(() => {
    const points = (imageSelection.points || [])
      .map((point) => ({
        x: Number(point?.x),
        y: Number(point?.y),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    const bounds = imageSelection.bounds || buildImageBoundsFromPoints(points)
    return {
      points,
      bounds,
    }
  }, [imageSelection])

  const hasImageSelection = useMemo(() => {
    const { points, bounds } = imageSelectionGeometry
    return points.length >= 3 && bounds && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY
  }, [imageSelectionGeometry])

  const clearSelectedRooms = useCallback(() => {
    setSelectedShapeId(null)
    setSelectedShapeIds([])
  }, [])

  const setSelectedRooms = useCallback((shapeIds, primaryShapeId = null) => {
    const normalizedIds = Array.from(new Set((shapeIds || []).map((value) => Number(value)).filter(Number.isFinite)))
    setSelectedShapeIds(normalizedIds)
    if (normalizedIds.length === 0) {
      setSelectedShapeId(null)
      return
    }
    if (primaryShapeId != null && normalizedIds.includes(Number(primaryShapeId))) {
      setSelectedShapeId(Number(primaryShapeId))
      return
    }
    setSelectedShapeId(normalizedIds[0])
  }, [])

  const locationOptionsForRoomModal = useMemo(() => {
    const mappedLocationIds = new Set(
      floors.flatMap((floor) =>
        (floor.roomShapes || [])
          .filter((shape) => Number(shape.id) !== Number(selectedShapeId))
          .map((shape) => Number(shape.locationId))
          .filter(Boolean)),
    )

    return locations.filter((location) => {
      if (roomDraft.mode === 'existing' && mappedLocationIds.has(Number(location.id))) {
        return false
      }
      if (!activeFloorId) return true
      return Number(location.floorId) === Number(activeFloorId)
    })
  }, [activeFloorId, floors, locations, roomDraft.mode, selectedShapeId])

  const roomShapeByLocationId = useMemo(() => {
    const next = new Map()
    floors.forEach((floor) => {
      ;(floor.roomShapes || []).forEach((shape) => {
        if (!shape?.locationId) return
        next.set(Number(shape.locationId), shape)
      })
    })
    return next
  }, [floors])

  const filteredLocationOptions = useMemo(() => {
    if (!searchFilters.floorId) return locations
    return locations.filter((location) => Number(location.floorId) === Number(searchFilters.floorId))
  }, [locations, searchFilters.floorId])

  const buildMovedRoomGroup = useCallback((floor, sourceShapes, rowDelta, colDelta) => {
    if (!floor || !sourceShapes?.length) return null

    const movedCellsById = new Map()
    const movingIds = new Set()

    for (const shape of sourceShapes) {
      const normalizedId = Number(shape.id)
      const candidateCells = shiftCells(shape.cells || [], rowDelta, colDelta)
      if (!areCellsInsideFloor(candidateCells, floor)) {
        return null
      }
      movedCellsById.set(normalizedId, candidateCells)
      movingIds.add(normalizedId)
    }

    const otherShapes = (floor.roomShapes || []).filter((shape) => !movingIds.has(Number(shape.id)))
    for (const shape of otherShapes) {
      const occupied = new Set(shape.cells || [])
      for (const candidateCells of movedCellsById.values()) {
        if (candidateCells.some((cell) => occupied.has(cell))) {
          return null
        }
      }
    }

    return movedCellsById
  }, [])

  const searchResultMap = useMemo(() => {
    const next = new Map()
    searchResults.forEach((asset) => {
      const bucket = next.get(asset.locationId) || []
      bucket.push(asset)
      next.set(asset.locationId, bucket)
    })
    return next
  }, [searchResults])

  const roomAssetCountMap = useMemo(() => {
    const next = new Map()
    roomAssetIndex.forEach((asset) => {
      if (!asset?.locationId) return
      next.set(asset.locationId, (next.get(asset.locationId) || 0) + 1)
    })
    return next
  }, [roomAssetIndex])

  const roomDraftDirty = useMemo(
    () => showRoomModal && buildRoomDraftSignature(roomDraft) !== roomModalInitialRef.current,
    [roomDraft, showRoomModal],
  )

  const areaTypeCatalogEntries = useMemo(
    () => (areaTypes.length > 0
      ? areaTypes
      : AREA_TYPE_PRESETS.map((item, index) => ({
        id: index + 1,
        typeKey: item.key,
        label: item.label,
        areaGroupKey: item.areaGroupKey,
        areaGroupLabel: item.areaGroupLabel,
        description: item.description,
        builtIn: true,
        sortOrder: (index + 1) * 10,
        usageCount: 0,
      }))),
    [areaTypes],
  )

  const floorFormDirty = useMemo(
    () => showFloorModal && buildFloorFormSignature(floorForm) !== floorModalInitialRef.current,
    [floorForm, showFloorModal],
  )

  const canvasFormDirty = useMemo(
    () => showCanvasModal && buildCanvasFormSignature(canvasForm) !== canvasModalInitialRef.current,
    [canvasForm, showCanvasModal],
  )

  const canvasColorConflict = useMemo(() => {
    if (!activeFloor) return null
    const nextCanvasColor = normalizeHexColor(canvasForm.canvasBackgroundColor, '#FFFFFF')
    const currentCanvasColor = normalizeHexColor(activeFloor.canvasBackgroundColor, '#FFFFFF')
    if (nextCanvasColor === currentCanvasColor) {
      return null
    }
    return findCanvasColorConflict(activeFloor.roomShapes, nextCanvasColor)
  }, [activeFloor, canvasForm.canvasBackgroundColor])

  const areaTypeOptions = useMemo(
    () => buildAreaTypeOptions(
      areaTypeCatalogEntries,
      floors.flatMap((floor) => (floor.roomShapes || []).map((shape) => ({
        key: shape.areaTypeKey,
        label: shape.areaTypeLabel,
      }))),
    ),
    [areaTypeCatalogEntries, floors],
  )

  const visibleShapeIdSet = useMemo(() => {
    return new Set((activeFloor?.roomShapes || []).map((shape) => Number(shape.id)))
  }, [activeFloor])

  const currentSelectionBounds = useMemo(() => {
    if (!activeFloor) return null
    if (isImageFloorMode(activeFloor)) {
      if ((floorInteractionMode === 'add' || floorInteractionMode === 'edit') && imageSelectionGeometry.bounds) {
        const bounds = imageSelectionGeometry.bounds
        return {
          left: bounds.minX,
          top: bounds.minY,
          width: Math.max(bounds.maxX - bounds.minX, 1),
          height: Math.max(bounds.maxY - bounds.minY, 1),
        }
      }
      if (selectedShape) {
        const bounds = selectedShape.bounds || buildImageBoundsFromPoints(getShapePoints(selectedShape))
        if (!bounds) return null
        return {
          left: bounds.minX,
          top: bounds.minY,
          width: Math.max(bounds.maxX - bounds.minX, 1),
          height: Math.max(bounds.maxY - bounds.minY, 1),
        }
      }
      return null
    }

    if ((floorInteractionMode === 'add' || floorInteractionMode === 'edit') && selectedCells.size > 0) {
      return buildSelectedCellsBounds(selectedCells, CELL_SIZE)
    }

    if (selectedShape) {
      const bounds = getShapeBounds(selectedShape)
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      }
    }

    return null
  }, [activeFloor, floorInteractionMode, imageSelectionGeometry.bounds, selectedCells, selectedShape])

  const surfaceMode = useMemo(() => {
    if (showRoomModal || floorInteractionMode === 'add') {
      return {
        key: 'assign',
        label: 'Gán phòng / tài sản',
        description: 'Đang tạo hoặc gắn khu vực với phòng nghiệp vụ và dữ liệu tài sản.',
      }
    }
    if (floorInteractionMode === 'edit' || floorInteractionMode === 'move' || canvasResizeState.enabled) {
      return {
        key: 'layout',
        label: 'Chỉnh sửa layout',
        description: 'Đang thay đổi phạm vi, màu hoặc vị trí khu vực trên sơ đồ.',
      }
    }
    return {
      key: 'view',
      label: 'Xem sơ đồ',
      description: 'Chế độ an toàn để xem, lọc, hover và rà soát sơ đồ hiện tại.',
    }
  }, [canvasResizeState.enabled, floorInteractionMode, showRoomModal])

  const selectedRoomSummary = useMemo(() => {
    if (!selectedShape) return null
    return {
      id: selectedShape.id,
      name: selectedShape.roomName || 'Khu vực chưa đặt tên',
      assetCount: roomAssetCountMap.get(selectedShape?.locationId) || 0,
      areaType: resolveAreaTypeMeta(selectedShape, areaTypeCatalogEntries),
      syncMeta: getRoomSyncMeta(selectedShape, locations),
      colorHex: selectedShape.colorHex || DEFAULT_COLOR,
    }
  }, [areaTypeCatalogEntries, locations, roomAssetCountMap, selectedShape])

  const showFloatingSelectionToolbar = useMemo(() => {
    if (!activeFloor || !currentSelectionBounds || showRoomModal) return false
    if (floorInteractionMode === 'view' && (drawTool === 'move' || roomDragState.active)) return false
    return floorInteractionMode === 'add' || floorInteractionMode === 'edit'
  }, [activeFloor, currentSelectionBounds, drawTool, floorInteractionMode, roomDragState.active, showRoomModal])

  const viewState = useMemo(() => ({
    loading,
    activeFloorId,
    floorInteractionMode,
    drawTool,
    selectionEnabled,
    searching,
    scannerOpen,
    showLeavePrompt,
    leaveActionBusy,
    markerTooltip,
  }), [
    activeFloorId,
    drawTool,
    floorInteractionMode,
    leaveActionBusy,
    loading,
    markerTooltip,
    scannerOpen,
    searching,
    selectionEnabled,
    showLeavePrompt,
  ])

  const selectionState = useMemo(() => ({
    selectedCells,
    selectedShapeId,
    selectedShapeIds,
    selectedShapes,
    dragSelection,
    isDraggingSelection,
    selectionMoveState,
    roomDragState,
    imageSelection,
    imageSelectionGeometry,
    imageVertexDragState,
    roomContextMenu,
    canvasContextMenu,
  }), [
    canvasContextMenu,
    dragSelection,
    imageSelection,
    imageSelectionGeometry,
    imageVertexDragState,
    isDraggingSelection,
    roomContextMenu,
    roomDragState,
    selectedCells,
    selectedShapeId,
    selectedShapeIds,
    selectedShapes,
    selectionMoveState,
  ])

  const draftState = useMemo(() => ({
    showImageImportModal,
    imageImportSession,
    selectedImportDrawingIds,
    showFloorModal,
    editingFloorId,
    floorForm,
    showCanvasModal,
    canvasModalMode,
    canvasForm,
    canvasResizeState,
    showRoomModal,
    roomDraft,
    nextTempShapeId,
  }), [
    canvasForm,
    canvasModalMode,
    canvasResizeState,
    editingFloorId,
    floorForm,
    imageImportSession,
    nextTempShapeId,
    roomDraft,
    selectedImportDrawingIds,
    showCanvasModal,
    showFloorModal,
    showImageImportModal,
    showRoomModal,
  ])

  const serverState = useMemo(() => ({
    floors,
    locations,
    categories,
    roomAssetIndex,
    dirtyFloorIds,
    savingLayout,
    savingFloor,
    importSubmitting,
    importApplying,
    roomAssetsLoading,
    roomAssets,
    searchResults,
  }), [
    categories,
    dirtyFloorIds,
    floors,
    importApplying,
    importSubmitting,
    locations,
    roomAssetIndex,
    roomAssets,
    roomAssetsLoading,
    savingFloor,
    savingLayout,
    searchResults,
  ])

  const hasUnsavedChanges = useMemo(
    () =>
      dirtyFloorIds.size > 0
      || selectedCells.size > 0
      || roomDraftDirty
      || floorFormDirty
      || canvasFormDirty
      || Boolean(canvasResizeState.handle)
      || isDraggingSelection
      || floorInteractionMode !== 'view',
    [canvasFormDirty, canvasResizeState.handle, dirtyFloorIds, floorFormDirty, floorInteractionMode, isDraggingSelection, roomDraftDirty, selectedCells],
  )

  const unsavedMessage = useMemo(() => {
    if (canvasResizeState.handle) {
      return 'Bạn đang kéo thay đổi kích thước canvas. Nếu rời trang lúc này, kích thước mới có thể chưa được lưu.'
    }
    if (floorInteractionMode === 'move') {
      return 'Bạn đang di chuyển phòng trên sơ đồ. Nếu rời trang lúc này, vị trí phòng vừa chỉnh có thể chưa được lưu.'
    }
    if (floorInteractionMode === 'edit') {
      return 'Bạn đang chỉnh sửa phạm vi hoặc thông tin phòng trên sơ đồ. Nếu rời trang lúc này, thay đổi của phòng có thể bị mất.'
    }
    if (floorInteractionMode === 'add') {
      return 'Bạn đang tạo phòng mới trên sơ đồ. Nếu rời trang lúc này, vùng chọn hoặc phòng đang tạo có thể bị mất.'
    }
    if (roomDraftDirty) {
      return 'Bạn đang tạo hoặc chỉnh sửa phòng trên sơ đồ. Nếu rời trang lúc này, thông tin phòng đang nhập có thể bị mất.'
    }
    if (floorFormDirty) {
      return 'Bạn đang tạo hoặc chỉnh sửa tầng. Nếu rời trang lúc này, thay đổi của tầng có thể chưa được lưu.'
    }
    if (canvasFormDirty) {
      return 'Bạn đang chỉnh màu nền hoặc kích thước canvas. Nếu rời trang lúc này, thay đổi của canvas có thể chưa được lưu.'
    }
    if (selectedCells.size > 0) {
      return 'Bạn đang có vùng chọn tạo phòng chưa hoàn tất. Nếu rời trang lúc này, vùng chọn sẽ bị mất.'
    }
    if (dirtyFloorIds.size > 0) {
      return 'Bạn đang có thay đổi sơ đồ chưa lưu. Nếu rời trang lúc này, các phòng vừa tạo hoặc chỉnh sửa có thể bị mất.'
    }
    return 'Bạn đang có thao tác chưa lưu. Nếu rời trang lúc này, dữ liệu có thể bị mất.'
  }, [canvasFormDirty, canvasResizeState.handle, dirtyFloorIds.size, floorFormDirty, floorInteractionMode, roomDraftDirty, selectedCells.size])

  const updateHistoryMeta = useCallback(() => {
    const history = historyStateRef.current
    setHistoryMeta({
      canUndo: history.past.length > 1,
      canRedo: history.future.length > 0,
    })
  }, [])

  const createHistorySnapshot = useCallback(() => ({
    floors: JSON.parse(JSON.stringify(floors)),
    dirtyFloorIds: Array.from(dirtyFloorIds),
    activeFloorId,
    selectedCells: Array.from(selectedCells),
    selectedShapeId,
    selectedShapeIds: [...selectedShapeIds],
    floorInteractionMode,
    drawTool,
    selectionEnabled,
    showRoomModal,
    roomDraft: { ...roomDraft },
    showCanvasModal,
    canvasModalMode,
    canvasForm: { ...canvasForm },
    canvasResizeState: { ...canvasResizeState },
    showFloorModal,
    editingFloorId,
    floorForm: { ...floorForm },
    imageSelection: JSON.parse(JSON.stringify(imageSelection)),
    imageVertexDragState: { ...imageVertexDragState },
    nextTempShapeId,
  }), [
    activeFloorId,
    canvasForm,
    canvasModalMode,
    canvasResizeState,
    dirtyFloorIds,
    drawTool,
    editingFloorId,
    floorForm,
    floorInteractionMode,
    floors,
    imageSelection,
    imageVertexDragState,
    nextTempShapeId,
    roomDraft,
    selectedCells,
    selectedShapeId,
    selectedShapeIds,
    selectionEnabled,
    showCanvasModal,
    showFloorModal,
    showRoomModal,
  ])

  const buildHistorySignature = useCallback((snapshot) => JSON.stringify({
    floors: (snapshot.floors || []).map((floor) => ({
      id: floor.id,
      gridRows: floor.gridRows,
      gridCols: floor.gridCols,
      canvasBackgroundColor: floor.canvasBackgroundColor,
      roomShapes: serializeRoomShapes(floor.roomShapes),
    })),
    dirtyFloorIds: snapshot.dirtyFloorIds,
    activeFloorId: snapshot.activeFloorId,
    selectedCells: snapshot.selectedCells,
    selectedShapeId: snapshot.selectedShapeId,
    selectedShapeIds: snapshot.selectedShapeIds,
    floorInteractionMode: snapshot.floorInteractionMode,
    drawTool: snapshot.drawTool,
    selectionEnabled: snapshot.selectionEnabled,
    showRoomModal: snapshot.showRoomModal,
    roomDraft: snapshot.roomDraft,
    showCanvasModal: snapshot.showCanvasModal,
    canvasModalMode: snapshot.canvasModalMode,
    canvasForm: snapshot.canvasForm,
    canvasResizeState: snapshot.canvasResizeState,
    showFloorModal: snapshot.showFloorModal,
    editingFloorId: snapshot.editingFloorId,
    floorForm: snapshot.floorForm,
    imageSelection: snapshot.imageSelection,
    nextTempShapeId: snapshot.nextTempShapeId,
  }), [])

  const pushHistorySnapshot = useCallback((snapshot, { clearFuture = true } = {}) => {
    const signature = buildHistorySignature(snapshot)
    const history = historyStateRef.current
    if (signature === history.lastSignature) return
    history.past.push(snapshot)
    if (history.past.length > 60) {
      history.past.shift()
    }
    if (clearFuture) {
      history.future = []
    }
    history.lastSignature = signature
    updateHistoryMeta()
  }, [buildHistorySignature, updateHistoryMeta])

  const captureHistoryBoundary = useCallback(() => {
    if (historyRestoreRef.current) return
    pushHistorySnapshot(createHistorySnapshot(), { clearFuture: false })
  }, [createHistorySnapshot, pushHistorySnapshot])

  const restoreHistorySnapshot = useCallback((snapshot) => {
    if (!snapshot) return
    historyRestoreRef.current = true
    setFloors(JSON.parse(JSON.stringify(snapshot.floors || [])))
    setDirtyFloorIds(new Set(snapshot.dirtyFloorIds || []))
    setActiveFloorId(snapshot.activeFloorId ?? null)
    setSelectedCells(new Set(snapshot.selectedCells || []))
    setSelectedShapeId(snapshot.selectedShapeId ?? null)
    setSelectedShapeIds(snapshot.selectedShapeIds || [])
    setFloorInteractionMode(snapshot.floorInteractionMode || 'view')
    setDrawTool(snapshot.drawTool || DEFAULT_DRAW_TOOL)
    setSelectionEnabled(Boolean(snapshot.selectionEnabled))
    setShowRoomModal(Boolean(snapshot.showRoomModal))
    setRoomDraft(snapshot.roomDraft || createDefaultRoomDraft())
    roomModalInitialRef.current = buildRoomDraftSignature(snapshot.roomDraft || createDefaultRoomDraft())
    setShowCanvasModal(Boolean(snapshot.showCanvasModal))
    setCanvasModalMode(snapshot.canvasModalMode || 'color')
    setCanvasForm(snapshot.canvasForm || createDefaultCanvasForm())
    canvasModalInitialRef.current = buildCanvasFormSignature(snapshot.canvasForm || createDefaultCanvasForm())
    setCanvasResizeState(snapshot.canvasResizeState || {
      enabled: false,
      floorId: null,
      handle: null,
      startX: 0,
      startY: 0,
      startRows: 0,
      startCols: 0,
      requiredRows: 1,
      requiredCols: 1,
    })
    setShowFloorModal(Boolean(snapshot.showFloorModal))
    setEditingFloorId(snapshot.editingFloorId ?? null)
    setFloorForm(snapshot.floorForm || createDefaultFloorForm())
    floorModalInitialRef.current = buildFloorFormSignature(snapshot.floorForm || createDefaultFloorForm())
    setImageSelection(snapshot.imageSelection || createDefaultImageSelection())
    setImageVertexDragState(snapshot.imageVertexDragState || createDefaultImageVertexDragState())
    setNextTempShapeId(snapshot.nextTempShapeId ?? -1)
    window.setTimeout(() => {
      historyRestoreRef.current = false
    }, 0)
  }, [])

  const handleUndo = useCallback(() => {
    const history = historyStateRef.current
    if (history.past.length <= 1) return
    const currentSnapshot = history.past.pop()
    if (currentSnapshot) {
      history.future.unshift(currentSnapshot)
    }
    const previousSnapshot = history.past[history.past.length - 1]
    history.lastSignature = previousSnapshot ? buildHistorySignature(previousSnapshot) : null
    updateHistoryMeta()
    restoreHistorySnapshot(previousSnapshot)
  }, [buildHistorySignature, restoreHistorySnapshot, updateHistoryMeta])

  const handleRedo = useCallback(() => {
    const history = historyStateRef.current
    if (history.future.length === 0) return
    const nextSnapshot = history.future.shift()
    if (!nextSnapshot) return
    history.past.push(nextSnapshot)
    history.lastSignature = buildHistorySignature(nextSnapshot)
    updateHistoryMeta()
    restoreHistorySnapshot(nextSnapshot)
  }, [buildHistorySignature, restoreHistorySnapshot, updateHistoryMeta])

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (typeof action === 'function') {
      action()
      return true
    }
    return false
  }, [])

  const requestGuardedAction = useCallback((action) => {
    if (leaveActionBusy) return
    if (hasUnsavedChanges && !bypassLeaveGuardRef.current) {
      pendingNavigationRef.current = null
      pendingActionRef.current = action
      setShowLeavePrompt(true)
      return
    }
    action()
  }, [hasUnsavedChanges, leaveActionBusy])

  useEffect(() => {
    if (historyRestoreRef.current) return
    const shouldTrackHistory = hasUnsavedChanges || hasImageSelection || canvasResizeState.enabled
    if (!shouldTrackHistory) return
    pushHistorySnapshot(createHistorySnapshot())
  }, [
    canvasResizeState.enabled,
    createHistorySnapshot,
    hasImageSelection,
    hasUnsavedChanges,
    pushHistorySnapshot,
  ])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target
      const isTypingTarget = target instanceof HTMLElement && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      )
      if (isTypingTarget) return
      const isMetaKey = event.metaKey || event.ctrlKey
      if (!isMetaKey) return

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        handleRedo()
        return
      }
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        handleUndo()
        return
      }
      if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleRedo, handleUndo])

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!hasUnsavedChanges) return
        event.preventDefault()
        event.returnValue = ''
      },
      [hasUnsavedChanges],
    ),
  )

  const loadRoomAssetIndex = useCallback(async () => {
    try {
      const response = await axiosClient.get('/api/asset-map/assets/search')
      setRoomAssetIndex(response.data || [])
    } catch {
      setRoomAssetIndex([])
    }
  }, [])

  const loadBootstrap = useCallback(async (preferredFloorId = null) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/asset-map/bootstrap')
      const nextFloors = response.data?.floors || []
      setFloors(nextFloors)
      setLocations(response.data?.locations || [])
      setCategories(response.data?.categories || [])
      setAreaTypes(response.data?.areaTypes || [])
      const nextActiveFloorId =
        preferredFloorId && nextFloors.some((floor) => Number(floor.id) === Number(preferredFloorId))
          ? preferredFloorId
          : nextFloors[0]?.id ?? null
      setActiveFloorId(nextActiveFloorId)
      setSelectedCells(new Set())
      clearSelectedRooms()
      setDirtyFloorIds(new Set())
      setShowFloorModal(false)
      setShowRoomModal(false)
      roomModalInitialRef.current = buildRoomDraftSignature(createDefaultRoomDraft())
      setEditingFloorId(null)
      setFloorForm(createDefaultFloorForm())
      floorModalInitialRef.current = buildFloorFormSignature(createDefaultFloorForm())
      setShowCanvasModal(false)
      setCanvasContextMenu(null)
      setCanvasForm(createDefaultCanvasForm())
      canvasModalInitialRef.current = buildCanvasFormSignature(createDefaultCanvasForm())
      setImageSelection(createDefaultImageSelection())
      setImageVertexDragState(createDefaultImageVertexDragState())
      setRoomDraft(createDefaultRoomDraft())
      setRoomPreview(null)
      setFloorInteractionMode('view')
      setDrawTool(DEFAULT_DRAW_TOOL)
      setSelectionEnabled(false)
      setIsDraggingSelection(false)
      setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
      setRoomDragState({ active: false, floorId: null, shapeIds: [], startX: 0, startY: 0, sourceShapes: [] })
      setRoomContextMenu(null)
      setShowRoomAssetsModal(false)
      setRoomAssets([])
      setDragSelection({
        active: false,
        floorId: null,
        startCell: null,
        baseSelection: new Set(),
        selectionMode: 'add',
      })
      await loadRoomAssetIndex()
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu sơ đồ tài sản.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [clearSelectedRooms, loadRoomAssetIndex])

  const cleanupImageImportSession = useCallback(async (sessionId) => {
    if (!sessionId) return
    try {
      await axiosClient.delete(`/api/asset-map/imports/${sessionId}`)
    } catch {
      // phien tam chi can cleanup best-effort
    }
  }, [])

  const closeImageImportModal = useCallback(() => {
    const currentSessionId = imageImportSession?.sessionId
    setShowImageImportModal(false)
    setImportSubmitting(false)
    setImportApplying(false)
    setImageImportSession(createDefaultImageImportState())
    setSelectedImportDrawingIds([])
    if (currentSessionId) {
      void cleanupImageImportSession(currentSessionId)
    }
  }, [cleanupImageImportSession, imageImportSession])

  const handleImageImportFileChange = useCallback(async (event) => {
    const nextFile = event.target.files?.[0]
    event.target.value = ''
    if (!nextFile) return

    if (imageImportSession?.sessionId) {
      await cleanupImageImportSession(imageImportSession.sessionId)
    }

    const formData = new FormData()
    formData.append('file', nextFile)
    setImportSubmitting(true)
    setImportApplying(false)
    setSelectedImportDrawingIds([])
    setImageImportSession(createDefaultImageImportState())

    try {
      const response = await axiosClient.post('/api/asset-map/imports/analyze', formData)
      const nextSession = response.data || createDefaultImageImportState()
      const drawingIds = (nextSession.drawings || []).map((drawing) => drawing.drawingId).filter(Boolean)
      setImageImportSession({
        sessionId: nextSession.sessionId || '',
        sourceFileName: nextSession.sourceFileName || nextFile.name,
        sourceFileType: nextSession.sourceFileType || '',
        drawings: nextSession.drawings || [],
      })
      setSelectedImportDrawingIds(drawingIds)
      toast.success('Tải ảnh nền thành công.')
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải ảnh nền sơ đồ.'
      toast.error(message)
    } finally {
      setImportSubmitting(false)
    }
  }, [cleanupImageImportSession, imageImportSession])

  const handleToggleImportDrawing = useCallback((drawingId) => {
    setSelectedImportDrawingIds((previous) =>
      previous.includes(drawingId)
        ? previous.filter((value) => value !== drawingId)
        : [...previous, drawingId],
    )
  }, [])

  const handleApplyImageImport = useCallback(async () => {
    if (!imageImportSession?.sessionId) {
      toast.error('Chưa có dữ liệu import để tạo sơ đồ.')
      return
    }
    if (!selectedImportDrawingIds.length) {
      toast.error('Hãy chọn ít nhất một ảnh nền.')
      return
    }

    setImportApplying(true)
    try {
      const response = await axiosClient.post(`/api/asset-map/imports/${imageImportSession.sessionId}/apply`, {
        drawingIds: selectedImportDrawingIds,
      })
      const createdFloorId = response.data?.createdFloorIds?.[0] || activeFloorId
      setShowImageImportModal(false)
      setImageImportSession(createDefaultImageImportState())
      setSelectedImportDrawingIds([])
      toast.success(response.data?.message || 'Đã tạo tầng ảnh nền thành công.')
      await loadBootstrap(createdFloorId)
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tạo tầng ảnh nền từ ảnh đã chọn.'
      toast.error(message)
    } finally {
      setImportApplying(false)
    }
  }, [activeFloorId, imageImportSession, loadBootstrap, selectedImportDrawingIds])

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void loadBootstrap()
    }, 0)

    return () => {
      window.clearTimeout(bootstrapTimer)
    }
  }, [loadBootstrap])

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!hasUnsavedChanges || bypassLeaveGuardRef.current) return

      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      const targetUrl = new URL(href, window.location.origin)
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const nextUrl = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`

      if (targetUrl.origin !== window.location.origin) return
      if (nextUrl === currentUrl) return

      event.preventDefault()
      pendingNavigationRef.current = nextUrl
      setShowLeavePrompt(true)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  useEffect(() => {
    const handlePopState = () => {
      if (!hasUnsavedChanges || bypassLeaveGuardRef.current) return

      const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const currentUrl = `${location.pathname}${location.search}${location.hash}`

      if (nextUrl === currentUrl) return

      pendingNavigationRef.current = nextUrl
      bypassLeaveGuardRef.current = true
      window.history.pushState(null, '', currentUrl)
      window.setTimeout(() => {
        bypassLeaveGuardRef.current = false
      }, 0)
      setShowLeavePrompt(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [hasUnsavedChanges, location.hash, location.pathname, location.search])

  useEffect(() => {
    if (!isDraggingSelection) return undefined

    const stopDragging = () => {
      setDragSelection((previous) => ({ ...previous, active: false }))
      setIsDraggingSelection(false)
    }

    window.addEventListener('mouseup', stopDragging)
    return () => {
      window.removeEventListener('mouseup', stopDragging)
    }
  }, [isDraggingSelection])

  const markFloorDirty = useCallback((floorId) => {
    setDirtyFloorIds((previous) => {
      const next = new Set(previous)
      next.add(floorId)
      return next
    })
  }, [])

  const replaceFloor = useCallback((floorId, updater) => {
    setFloors((previous) =>
      previous.map((floor) => (Number(floor.id) === Number(floorId) ? updater(floor) : floor)),
    )
  }, [])

  const applyFloorResponse = useCallback((responseFloor, options = {}) => {
    if (!responseFloor?.id) return
    const {
      preserveRoomShapes = false,
      forceRoomShapes = null,
      selectFloor = true,
      keepSelection = false,
      closeModals = false,
    } = options

    setFloors((previous) =>
      previous.map((floor) => {
        if (Number(floor.id) !== Number(responseFloor.id)) return floor
        return {
          ...floor,
          ...responseFloor,
          roomShapes: forceRoomShapes
            || (preserveRoomShapes ? floor.roomShapes : (responseFloor.roomShapes || floor.roomShapes || [])),
        }
      }),
    )

    if (selectFloor) {
      setActiveFloorId(responseFloor.id)
    }
    if (!keepSelection) {
      clearSelectedRooms()
      setSelectedCells(new Set())
    }
    if (closeModals) {
      setShowFloorModal(false)
      setShowCanvasModal(false)
      setShowRoomModal(false)
    }
  }, [clearSelectedRooms])

  const clearDirtyFloor = useCallback((floorId) => {
    setDirtyFloorIds((previous) => {
      if (!previous.has(floorId)) return previous
      const next = new Set(previous)
      next.delete(floorId)
      return next
    })
  }, [])

  const saveFloorSnapshot = useCallback(async (floorSnapshot, successMessage) => {
    if (!floorSnapshot?.id) return false
    setSavingLayout(true)
    try {
      const response = await axiosClient.put(`/api/asset-map/floors/${floorSnapshot.id}/layout`, {
        roomShapes: serializeRoomShapes(floorSnapshot.roomShapes),
      })
      applyFloorResponse(response.data, {
        forceRoomShapes: response.data?.roomShapes || floorSnapshot.roomShapes,
        selectFloor: true,
        keepSelection: true,
      })
      if (successMessage) {
        toast.success(successMessage)
      }
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Lưu sơ đồ thất bại.'
      toast.error(message)
      return false
    } finally {
      setSavingLayout(false)
    }
  }, [applyFloorResponse])

  const persistCanvasSettings = useCallback(async ({
    floorId,
    gridRows,
    gridCols,
    canvasBackgroundColor,
    successMessage,
    closeModal = true,
  }) => {
    const floor = floors.find((item) => Number(item.id) === Number(floorId))
    if (!floor) return false

    const nextGridRows = Number(gridRows) || floor.gridRows || 12
    const nextGridCols = Number(gridCols) || floor.gridCols || 20
    const nextCanvasColor = normalizeHexColor(canvasBackgroundColor || floor.canvasBackgroundColor || '#FFFFFF', '#FFFFFF')
    const currentCanvasColor = normalizeHexColor(floor.canvasBackgroundColor || '#FFFFFF', '#FFFFFF')
    const requiredSize = getRequiredCanvasSize(floor.roomShapes)

    if (nextGridRows < requiredSize.gridRows || nextGridCols < requiredSize.gridCols) {
      toast.error(
        `Canvas quá nhỏ. Hiện cần ít nhất ${requiredSize.gridRows} hàng và ${requiredSize.gridCols} cột để chứa các phòng đang có.`,
      )
      return false
    }

    if (nextCanvasColor !== currentCanvasColor) {
      const colorConflict = findCanvasColorConflict(floor.roomShapes, nextCanvasColor)
      if (colorConflict) {
        toast.error(
          `Không thể dùng ${nextCanvasColor} làm màu nền vì quá giống màu của khu vực ${colorConflict.shape?.roomName || 'đang có'} (${colorConflict.colorHex}). Hãy chọn màu khác để giữ độ tương phản trên sơ đồ.`,
        )
        return false
      }
    }

    try {
      const response = await axiosClient.put(`/api/asset-map/floors/${floor.id}`, {
        name: floor.name,
        gridRows: nextGridRows,
        gridCols: nextGridCols,
        sortOrder: floor.sortOrder,
        canvasBackgroundColor: nextCanvasColor,
      })

      const responseFloor = response.data
      applyFloorResponse(responseFloor, {
        preserveRoomShapes: dirtyFloorIds.has(floor.id),
        selectFloor: true,
        keepSelection: true,
      })

      if (closeModal) {
        setShowCanvasModal(false)
      }
      setCanvasContextMenu(null)
      setCanvasForm((previous) => ({
        ...previous,
        gridRows: nextGridRows,
        gridCols: nextGridCols,
        canvasBackgroundColor: nextCanvasColor,
      }))
      if (successMessage) {
        toast.success(successMessage)
      }
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật canvas của tầng.'
      toast.error(message)
      return false
    }
  }, [applyFloorResponse, dirtyFloorIds, floors])

  const openConfirmDialog = useCallback((config) => {
    confirmActionRef.current = typeof config?.onConfirm === 'function' ? config.onConfirm : null
    setConfirmDialog({
      open: true,
      title: config?.title || 'Xác nhận thao tác',
      message: config?.message || '',
      confirmLabel: config?.confirmLabel || 'Đồng ý',
      cancelLabel: config?.cancelLabel || 'Hủy',
      tone: config?.tone || 'danger',
      busy: false,
    })
  }, [])

  const closeConfirmDialog = useCallback(() => {
    confirmActionRef.current = null
    setConfirmDialog((previous) => ({ ...previous, open: false, busy: false }))
  }, [])

  useEffect(() => {
    if (floorInteractionMode !== 'move' || !activeFloor || selectedShapes.length === 0) return undefined

    const handleKeyDown = (event) => {
      const arrowOffsets = {
        ArrowUp: { row: -1, col: 0 },
        ArrowDown: { row: 1, col: 0 },
        ArrowLeft: { row: 0, col: -1 },
        ArrowRight: { row: 0, col: 1 },
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const floorSnapshot = {
          ...activeFloor,
          roomShapes: [...(activeFloor.roomShapes || [])],
        }
        void (async () => {
          const saved = await saveFloorSnapshot(floorSnapshot, 'Đã lưu vị trí phòng trên sơ đồ.')
          if (!saved) return
          clearDirtyFloor(activeFloor.id)
          setFloorInteractionMode('view')
          setSelectionEnabled(false)
        })()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setFloorInteractionMode('view')
        setSelectionEnabled(false)
        return
      }

      const step = arrowOffsets[event.key]
      if (!step) return

      event.preventDefault()
      let multiplier = 1

      while (multiplier <= Math.max(activeFloor.gridRows, activeFloor.gridCols) + 2) {
        const movedCellsById = buildMovedRoomGroup(activeFloor, selectedShapes, step.row * multiplier, step.col * multiplier)
        if (!movedCellsById) {
          const anyOutside = selectedShapes.some((shape) => {
            const candidateCells = shiftCells(shape.cells || [], step.row * multiplier, step.col * multiplier)
            return !areCellsInsideFloor(candidateCells, activeFloor)
          })
          if (anyOutside) {
            return
          }
        } else {
          replaceFloor(activeFloor.id, (floor) => ({
            ...floor,
            roomShapes: (floor.roomShapes || []).map((shape) =>
              movedCellsById.has(Number(shape.id))
                ? { ...shape, cells: movedCellsById.get(Number(shape.id)) }
                : shape),
          }))
          markFloorDirty(activeFloor.id)
          return
        }

        multiplier += 1
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeFloor, buildMovedRoomGroup, clearDirtyFloor, floorInteractionMode, markFloorDirty, replaceFloor, saveFloorSnapshot, selectedShapes])

  useEffect(() => {
    if (!canvasResizeState.handle || !canvasResizeState.floorId) return undefined

    const handleMouseMove = (event) => {
      const rowDelta = Math.round((event.clientY - canvasResizeState.startY) / CELL_SIZE)
      const colDelta = Math.round((event.clientX - canvasResizeState.startX) / CELL_SIZE)
      const allowRows = canvasResizeState.handle === 'bottom' || canvasResizeState.handle === 'corner'
      const allowCols = canvasResizeState.handle === 'right' || canvasResizeState.handle === 'corner'
      const nextRows = Math.max(
        canvasResizeState.requiredRows,
        Math.min(100, canvasResizeState.startRows + (allowRows ? rowDelta : 0)),
      )
      const nextCols = Math.max(
        canvasResizeState.requiredCols,
        Math.min(100, canvasResizeState.startCols + (allowCols ? colDelta : 0)),
      )

      setFloors((previous) =>
        previous.map((floor) =>
          Number(floor.id) === Number(canvasResizeState.floorId)
            ? { ...floor, gridRows: nextRows, gridCols: nextCols }
            : floor),
      )
      setCanvasForm((previous) => ({
        ...previous,
        gridRows: nextRows,
        gridCols: nextCols,
      }))
    }

    const handleMouseUp = () => {
      const resizedFloor = floors.find((floor) => Number(floor.id) === Number(canvasResizeState.floorId))
      const nextRows = resizedFloor?.gridRows || canvasResizeState.startRows
      const nextCols = resizedFloor?.gridCols || canvasResizeState.startCols
      const rowsChanged = nextRows !== canvasResizeState.startRows
      const colsChanged = nextCols !== canvasResizeState.startCols

      setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null }))

      if (!rowsChanged && !colsChanged) return

      void persistCanvasSettings({
        floorId: canvasResizeState.floorId,
        gridRows: nextRows,
        gridCols: nextCols,
        canvasBackgroundColor: resizedFloor?.canvasBackgroundColor || '#FFFFFF',
        successMessage: 'Đã cập nhật kích thước canvas.',
        closeModal: false,
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [canvasResizeState, floors, persistCanvasSettings])

  useEffect(() => {
    if (!selectionMoveState.active || !activeFloor) return undefined

    const handleMouseUp = () => {
      setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeFloor, selectionMoveState.active])

  useEffect(() => {
    if (!roomDragState.active || !activeFloor) return undefined

    const handleMouseMove = (event) => {
      const rowDelta = Math.round((event.clientY - roomDragState.startY) / CELL_SIZE)
      const colDelta = Math.round((event.clientX - roomDragState.startX) / CELL_SIZE)
      const movedCellsById = buildMovedRoomGroup(activeFloor, roomDragState.sourceShapes, rowDelta, colDelta)
      if (!movedCellsById) return

      replaceFloor(activeFloor.id, (floor) => ({
        ...floor,
        roomShapes: (floor.roomShapes || []).map((shape) =>
          movedCellsById.has(Number(shape.id))
            ? { ...shape, cells: movedCellsById.get(Number(shape.id)) }
            : shape),
      }))
      markFloorDirty(activeFloor.id)
    }

    const handleMouseUp = () => {
      const sourceShapes = roomDragState.sourceShapes || []
      const sourceShapeIds = new Set(sourceShapes.map((shape) => Number(shape.id)))
      const movedShapes = (activeFloor.roomShapes || []).filter((shape) => sourceShapeIds.has(Number(shape.id)))
      setRoomDragState({ active: false, floorId: null, shapeIds: [], startX: 0, startY: 0, sourceShapes: [] })
      setDrawTool(DEFAULT_DRAW_TOOL)
      if (movedShapes.length === 0) return

      const changed = sourceShapes.some((sourceShape) => {
        const movedShape = movedShapes.find((shape) => Number(shape.id) === Number(sourceShape.id))
        return JSON.stringify([...(movedShape?.cells || [])].sort(compareCells))
          !== JSON.stringify([...(sourceShape.cells || [])].sort(compareCells))
      })
      if (!changed) return

      void (async () => {
        const saved = await saveFloorSnapshot(
          {
            ...activeFloor,
            roomShapes: [...(activeFloor.roomShapes || [])],
          },
          'Đã di chuyển phòng trên sơ đồ.',
        )
        if (!saved) return
        clearDirtyFloor(activeFloor.id)
      })()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeFloor, buildMovedRoomGroup, clearDirtyFloor, markFloorDirty, replaceFloor, roomDragState, saveFloorSnapshot])

  const scrollToFloor = useCallback((floorId) => {
    const target = document.getElementById(`asset-map-floor-${floorId}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const applyDraggedSelection = useCallback((cellKey) => {
    if (!dragSelection.active || !dragSelection.startCell) return

    const nextSelection = new Set(dragSelection.baseSelection)
    buildCellRectangle(dragSelection.startCell, cellKey).forEach((cell) => {
      if (dragSelection.selectionMode === 'remove') {
        nextSelection.delete(cell)
        return
      }
      nextSelection.add(cell)
    })
    setSelectedCells(nextSelection)
  }, [dragSelection])

  const clearDragState = useCallback(() => {
    setDragSelection({
      active: false,
      floorId: null,
      startCell: null,
      baseSelection: new Set(),
      selectionMode: 'add',
    })
    setIsDraggingSelection(false)
  }, [])

  const setActiveDrawTool = useCallback((tool) => {
    setDrawTool(tool)
    setSelectionEnabled(tool === 'select' && (floorInteractionMode === 'add' || floorInteractionMode === 'edit'))
  }, [floorInteractionMode])

  const exitInteractionMode = useCallback((keepSelectedShape = true) => {
    setFloorInteractionMode('view')
    setDrawTool(DEFAULT_DRAW_TOOL)
    setSelectionEnabled(false)
    setSelectedCells(new Set())
    clearDragState()
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomDragState({ active: false, floorId: null, shapeIds: [], startX: 0, startY: 0, sourceShapes: [] })
    setShowRoomModal(false)
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setImageSelection(createDefaultImageSelection())
    setImageVertexDragState(createDefaultImageVertexDragState())
    if (!keepSelectedShape) {
      clearSelectedRooms()
    }
  }, [clearDragState, clearSelectedRooms])

  const beginAddRoomMode = useCallback((floorId) => {
    const targetFloor = floors.find((floor) => Number(floor.id) === Number(floorId))
    const imageFloor = isImageFloorMode(targetFloor)
    setActiveFloorId(floorId)
    setFloorInteractionMode('add')
    setDrawTool(imageFloor ? IMAGE_RECTANGLE_TOOL : DEFAULT_DRAW_TOOL)
    setSelectionEnabled(!imageFloor)
    clearSelectedRooms()
    setSelectedCells(new Set())
    setImageSelection(createDefaultImageSelection())
    setImageVertexDragState(createDefaultImageVertexDragState())
    clearDragState()
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setRoomDraft(createDefaultRoomDraft())
  }, [clearDragState, clearSelectedRooms, floors])

  const beginEditRoomMode = useCallback((shape, floorId) => {
    if (!shape) return
    const targetFloor = floors.find((floor) => Number(floor.id) === Number(floorId))
    const imageFloor = isImageFloorMode(targetFloor)
    setActiveFloorId(floorId)
    setSelectedRooms([shape.id], shape.id)
    setFloorInteractionMode('edit')
    setDrawTool(imageFloor ? IMAGE_RECTANGLE_TOOL : DEFAULT_DRAW_TOOL)
    setSelectionEnabled(!imageFloor)
    setSelectedCells(new Set(imageFloor ? [] : (shape.cells || [])))
    setImageSelection(imageFloor
      ? {
        points: getShapePoints(shape),
        bounds: shape.bounds || buildImageBoundsFromPoints(getShapePoints(shape)),
        drawing: false,
        startPoint: null,
        hoverPoint: null,
      }
      : createDefaultImageSelection())
    setImageVertexDragState(createDefaultImageVertexDragState())
    clearDragState()
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    const areaTypeDraft = resolveAreaTypeDraft(shape, areaTypeCatalogEntries)
    setRoomDraft({
      mode: shape.locationId ? 'existing' : 'new',
      locationId: shape.locationId ? String(shape.locationId) : '',
      roomName: shape.roomName || '',
      colorHex: shape.colorHex || DEFAULT_COLOR,
      areaTypeKey: areaTypeDraft.areaTypeKey,
      areaTypeLabel: areaTypeDraft.areaTypeLabel,
      areaGroupKey: areaTypeDraft.areaGroupKey,
      areaGroupLabel: areaTypeDraft.areaGroupLabel,
    })
  }, [areaTypeCatalogEntries, clearDragState, floors, setSelectedRooms])

  const openRoomModalWithDraft = useCallback((nextDraft) => {
    roomModalInitialRef.current = buildRoomDraftSignature(nextDraft)
    setRoomDraft(nextDraft)
    setShowRoomModal(true)
  }, [])

  const openRoomInfoModal = useCallback((shape, floorId) => {
    if (!shape) return
    setActiveFloorId(floorId)
    setSelectedRooms([shape.id], shape.id)
    setDrawTool(DEFAULT_DRAW_TOOL)
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setImageSelection(createDefaultImageSelection())
    setImageVertexDragState(createDefaultImageVertexDragState())
    const areaTypeDraft = resolveAreaTypeDraft(shape, areaTypeCatalogEntries)
    openRoomModalWithDraft({
      mode: shape.locationId ? 'existing' : 'new',
      locationId: shape.locationId ? String(shape.locationId) : '',
      roomName: shape.roomName || '',
      colorHex: shape.colorHex || DEFAULT_COLOR,
      areaTypeKey: areaTypeDraft.areaTypeKey,
      areaTypeLabel: areaTypeDraft.areaTypeLabel,
      areaGroupKey: areaTypeDraft.areaGroupKey,
      areaGroupLabel: areaTypeDraft.areaGroupLabel,
    })
  }, [areaTypeCatalogEntries, openRoomModalWithDraft, setSelectedRooms])

  const openRoomDraftModal = useCallback((shape = null, geometryOverride = null) => {
    const targetImageGeometry = geometryOverride || imageSelectionGeometry
    const imageFloor = isImageFloorMode(activeFloor)
    let nextDraft = roomDraft
    if (floorInteractionMode === 'add') {
      if (imageFloor) {
        if (!targetImageGeometry?.points?.length || !targetImageGeometry?.bounds) {
          toast.error('Hãy vẽ một vùng trên ảnh trước khi tạo phòng.')
          return
        }
      } else if (selectedCells.size === 0) {
        toast.error('Hãy chọn ít nhất một ô vuông để tạo phòng.')
        return
      }
      nextDraft = {
        ...createDefaultRoomDraft(),
        colorHex: roomDraft.colorHex || DEFAULT_COLOR,
      }
    }

    if (floorInteractionMode === 'edit') {
      if (!shape && !selectedShape) {
        toast.error('Hãy chọn phòng cần sửa.')
        return
      }
      if (imageFloor) {
        if (!targetImageGeometry?.points?.length || !targetImageGeometry?.bounds) {
          toast.error('Hãy vẽ lại phạm vi của phòng trên ảnh trước khi lưu.')
          return
        }
      } else if (selectedCells.size === 0) {
        toast.error('Hãy chọn lại phạm vi của phòng trước khi lưu.')
        return
      }
      const targetShape = shape || selectedShape
      const areaTypeDraft = resolveAreaTypeDraft(targetShape, areaTypeCatalogEntries)
      nextDraft = {
        mode: targetShape.locationId ? 'existing' : 'new',
        locationId: targetShape.locationId ? String(targetShape.locationId) : '',
        roomName: targetShape.roomName || '',
        colorHex: targetShape.colorHex || DEFAULT_COLOR,
        areaTypeKey: areaTypeDraft.areaTypeKey,
        areaTypeLabel: areaTypeDraft.areaTypeLabel,
        areaGroupKey: areaTypeDraft.areaGroupKey,
        areaGroupLabel: areaTypeDraft.areaGroupLabel,
      }
    }

    openRoomModalWithDraft(nextDraft)
  }, [activeFloor, areaTypeCatalogEntries, floorInteractionMode, imageSelectionGeometry, openRoomModalWithDraft, roomDraft.colorHex, selectedCells.size, selectedShape])

  const getImagePointerPositionFromClient = useCallback((clientX, clientY, floor, svgElement = imageSvgRef.current) => {
    const svgRect = svgElement?.getBoundingClientRect?.()
    if (!svgRect) {
      return {
        x: 0,
        y: 0,
      }
    }
    const width = floor?.imageWidth || svgRect.width || 1
    const height = floor?.imageHeight || svgRect.height || 1
    const scaleX = width / Math.max(svgRect.width, 1)
    const scaleY = height / Math.max(svgRect.height, 1)
    const rawPoint = {
      x: clampNumber((clientX - svgRect.left) * scaleX, 0, width),
      y: clampNumber((clientY - svgRect.top) * scaleY, 0, height),
    }
    return snapCanvasPoint(rawPoint, floor, snapEnabled)
  }, [snapEnabled])

  const getImagePointerPosition = useCallback((event, floor) => {
    return getImagePointerPositionFromClient(event.clientX, event.clientY, floor, event.currentTarget)
  }, [getImagePointerPositionFromClient])

  const commitImageGeometry = useCallback((points) => {
    const bounds = buildImageBoundsFromPoints(points)
    setImageSelection({
      points,
      bounds,
      drawing: false,
      startPoint: null,
      hoverPoint: null,
    })
    return { points, bounds }
  }, [])

  const handleImageVertexPointerDown = useCallback((event, floor, pointIndex) => {
    if (!isImageFloorMode(floor) || Number(floor.id) !== Number(activeFloorId)) return
    if (!(floorInteractionMode === 'add' || floorInteractionMode === 'edit')) return
    if ((imageSelectionGeometry.points || []).length === 0) return

    event.preventDefault()
    event.stopPropagation()

    const rectangleAnchorPoint = drawTool === IMAGE_RECTANGLE_TOOL && imageSelectionGeometry.points.length === 4
      ? imageSelectionGeometry.points[getOppositeRectanglePointIndex(pointIndex)]
      : null

    setImageVertexDragState({
      active: true,
      floorId: floor.id,
      pointIndex,
      rectangleAnchorPoint,
    })
  }, [activeFloorId, drawTool, floorInteractionMode, imageSelectionGeometry.points])

  const handleImagePointerDown = useCallback((event, floor) => {
    if (!isImageFloorMode(floor) || Number(floor.id) !== Number(activeFloorId)) return
    if (!(floorInteractionMode === 'add' || floorInteractionMode === 'edit')) return
    if (drawTool !== IMAGE_RECTANGLE_TOOL) return

    event.preventDefault()
    event.stopPropagation()
    const point = getImagePointerPosition(event, floor)
    const points = buildRectanglePoints(point, point)
    setImageSelection({
      points,
      bounds: buildImageBoundsFromPoints(points),
      drawing: true,
      startPoint: point,
      hoverPoint: point,
    })
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }, [activeFloorId, drawTool, floorInteractionMode, getImagePointerPosition])

  const handleImagePointerMove = useCallback((event, floor) => {
    if (!isImageFloorMode(floor) || Number(floor.id) !== Number(activeFloorId)) return
    if (!(floorInteractionMode === 'add' || floorInteractionMode === 'edit')) return

    const point = getImagePointerPosition(event, floor)
    if (drawTool === IMAGE_RECTANGLE_TOOL && imageSelection.drawing && imageSelection.startPoint) {
      const points = buildRectanglePoints(imageSelection.startPoint, point)
      setImageSelection((previous) => ({
        ...previous,
        points,
        bounds: buildImageBoundsFromPoints(points),
        hoverPoint: point,
      }))
      return
    }

    if (drawTool === IMAGE_POLYGON_TOOL) {
      setImageSelection((previous) => ({
        ...previous,
        hoverPoint: point,
      }))
    }
  }, [activeFloorId, drawTool, floorInteractionMode, getImagePointerPosition, imageSelection.drawing, imageSelection.startPoint])

  const handleImagePointerUp = useCallback((event, floor) => {
    if (!isImageFloorMode(floor) || Number(floor.id) !== Number(activeFloorId)) return
    if (!(floorInteractionMode === 'add' || floorInteractionMode === 'edit')) return
    if (drawTool !== IMAGE_RECTANGLE_TOOL || !imageSelection.drawing || !imageSelection.startPoint) return

    event.preventDefault()
    event.stopPropagation()
    const point = getImagePointerPosition(event, floor)
    const points = buildRectanglePoints(imageSelection.startPoint, point)
    const bounds = buildImageBoundsFromPoints(points)
    if (!bounds || Math.abs(bounds.maxX - bounds.minX) < 8 || Math.abs(bounds.maxY - bounds.minY) < 8) {
      setImageSelection(createDefaultImageSelection())
      return
    }
    commitImageGeometry(points)
  }, [activeFloorId, commitImageGeometry, drawTool, floorInteractionMode, getImagePointerPosition, imageSelection.drawing, imageSelection.startPoint])

  const handleImageCanvasClick = useCallback((event, floor) => {
    if (!isImageFloorMode(floor) || Number(floor.id) !== Number(activeFloorId)) return
    if (floorInteractionMode === 'view') {
      if (event.target !== event.currentTarget) return
      clearSelectedRooms()
      setRoomContextMenu(null)
      setCanvasContextMenu(null)
      setRoomPreview(null)
      return
    }
    if (!(floorInteractionMode === 'add' || floorInteractionMode === 'edit')) return
    if (drawTool !== IMAGE_POLYGON_TOOL) return

    event.preventDefault()
    event.stopPropagation()
    const point = getImagePointerPosition(event, floor)
    setImageSelection((previous) => {
      const currentPoints = previous.points || []
      const replaceExisting = currentPoints.length >= 3 && !previous.drawing
      const nextPoints = replaceExisting ? [point] : [...currentPoints, point]
      return {
        points: nextPoints,
        bounds: buildImageBoundsFromPoints(nextPoints),
        drawing: false,
        startPoint: null,
        hoverPoint: point,
      }
    })
  }, [activeFloorId, clearSelectedRooms, drawTool, floorInteractionMode, getImagePointerPosition])

  const finishImagePolygon = useCallback(() => {
    if (!hasImageSelection || drawTool !== IMAGE_POLYGON_TOOL) {
      toast.error('Hãy chọn ít nhất 3 điểm để tạo vùng polygon.')
      return
    }
    commitImageGeometry(imageSelectionGeometry.points)
  }, [commitImageGeometry, drawTool, hasImageSelection, imageSelectionGeometry.points])

  useEffect(() => {
    if (!imageVertexDragState.active || !activeFloor || !isImageFloorMode(activeFloor)) return undefined

    const handlePointerMove = (event) => {
      const point = getImagePointerPositionFromClient(event.clientX, event.clientY, activeFloor)
      setImageSelection((previous) => {
        const currentPoints = [...(previous.points || [])]
        const pointIndex = Number(imageVertexDragState.pointIndex)
        if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= currentPoints.length) {
          return previous
        }

        const nextPoints = imageVertexDragState.rectangleAnchorPoint
          ? buildRectanglePoints(imageVertexDragState.rectangleAnchorPoint, point)
          : currentPoints.map((item, index) => (index === pointIndex ? point : item))

        return {
          ...previous,
          points: nextPoints,
          bounds: buildImageBoundsFromPoints(nextPoints),
          drawing: false,
          startPoint: null,
          hoverPoint: point,
        }
      })
    }

    const stopVertexDrag = () => {
      setImageVertexDragState(createDefaultImageVertexDragState())
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopVertexDrag)
    window.addEventListener('pointercancel', stopVertexDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopVertexDrag)
      window.removeEventListener('pointercancel', stopVertexDrag)
    }
  }, [activeFloor, getImagePointerPositionFromClient, imageVertexDragState])

  useEffect(() => {
    if (!activeFloor || !isImageFloorMode(activeFloor)) return undefined
    if (!(floorInteractionMode === 'add' || floorInteractionMode === 'edit')) return undefined
    if (drawTool !== IMAGE_POLYGON_TOOL || showRoomModal) return undefined

    const handleKeyDown = (event) => {
      const target = event.target
      const isTypingTarget = target instanceof HTMLElement && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      )
      if (isTypingTarget) return

      if (event.key === 'Enter' && hasImageSelection) {
        event.preventDefault()
        finishImagePolygon()
        return
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && (imageSelection.points || []).length > 0) {
        event.preventDefault()
        setImageSelection((previous) => {
          const nextPoints = [...(previous.points || [])]
          nextPoints.pop()
          return {
            ...previous,
            points: nextPoints,
            bounds: buildImageBoundsFromPoints(nextPoints),
            hoverPoint: nextPoints[nextPoints.length - 1] || null,
          }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeFloor, drawTool, finishImagePolygon, floorInteractionMode, hasImageSelection, imageSelection.points, showRoomModal])

  const handleCellPointerDown = (event, floor, cellKey, shape) => {
    if (Number(floor.id) !== Number(activeFloorId)) {
      requestGuardedAction(() => {
        setActiveFloorId(floor.id)
        exitInteractionMode(false)
      })
      return
    }

    if (!showGridLines) {
      return
    }

    if (floorInteractionMode === 'view' && !shape) {
      event.preventDefault()
      clearSelectedRooms()
      setRoomContextMenu(null)
      setCanvasContextMenu(null)
      setRoomPreview(null)
      return
    }

    if (drawTool === 'paint') {
      event.preventDefault()
      if (floorInteractionMode === 'edit') {
        setRoomDraft((previous) => ({ ...previous, colorHex: currentPaintColor }))
      }
      return
    }

    if (drawTool === 'move') {
      event.preventDefault()
      const currentSelection = new Set(selectedCells)
      if (!currentSelection.has(cellKey)) {
        toast.info('Hãy bấm vào vùng đang chọn để kéo di chuyển.')
        return
      }
      setSelectionMoveState({
        active: true,
        floorId: floor.id,
        startCell: cellKey,
        sourceCells: Array.from(currentSelection),
      })
      return
    }

    if (!selectionEnabled) {
      return
    }

    if (shape && Number(shape.id) !== editableShapeId) {
      setSelectedRooms([shape.id], shape.id)
      toast.info('Ô này đang thuộc một phòng khác. Hãy chọn vùng trống hoặc vùng của phòng đang sửa.')
      return
    }

    event.preventDefault()
    if (floorInteractionMode === 'add') {
      clearSelectedRooms()
    }
    const shouldAccumulateSelection = floorInteractionMode === 'add'
      || floorInteractionMode === 'edit'
      || event.shiftKey
      || event.metaKey
      || event.ctrlKey
    const currentSelection = new Set(selectedCells)
    const selectionMode = currentSelection.has(cellKey) && (floorInteractionMode === 'add' || floorInteractionMode === 'edit')
      ? 'remove'
      : 'add'
    const baseSelection = shouldAccumulateSelection || selectionMode === 'remove'
      ? new Set(currentSelection)
      : new Set()

    setDragSelection({
      active: true,
      floorId: floor.id,
      startCell: cellKey,
      baseSelection,
      selectionMode,
    })
    setIsDraggingSelection(true)
    const nextSelection = new Set(baseSelection)
    if (selectionMode === 'remove') {
      nextSelection.delete(cellKey)
    } else {
      nextSelection.add(cellKey)
    }
    setSelectedCells(nextSelection)
  }

  const handleCellPointerEnter = (floor, cellKey, shape) => {
    if (selectionMoveState.active) {
      if (Number(selectionMoveState.floorId) !== Number(floor.id)) return
      const sourceCells = selectionMoveState.sourceCells || []
      const startCell = selectionMoveState.startCell
      if (!startCell || sourceCells.length === 0) return

      const start = parseCell(startCell)
      const target = parseCell(cellKey)
      const candidateCells = shiftCells(sourceCells, target.row - start.row, target.col - start.col)

      if (!areCellsInsideFloor(candidateCells, floor)) return
      if (hasCellCollision(candidateCells, floor, editableShapeId)) return
      setSelectedCells(new Set(candidateCells))
      return
    }

    if (!selectionEnabled) return
    if (shape && Number(shape.id) !== editableShapeId) return
    if (!dragSelection.active) return
    if (Number(dragSelection.floorId) !== Number(floor.id)) return
    applyDraggedSelection(cellKey)
  }

  const handleCellPointerUp = () => {
    if (selectionMoveState.active) {
      setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
      return
    }

    setDragSelection((previous) => ({ ...previous, active: false }))
    setIsDraggingSelection(false)
  }

  const openCreateFloorModal = () => {
    const nextFloorForm = createDefaultFloorForm()
    setEditingFloorId(null)
    floorModalInitialRef.current = buildFloorFormSignature(nextFloorForm)
    setFloorForm(nextFloorForm)
    setShowFloorModal(true)
  }

  const openEditFloorModal = (floor) => {
    const nextFloorForm = {
      name: floor.name || '',
      mode: floor.mode || 'GRID',
      gridRows: floor.gridRows || 12,
      gridCols: floor.gridCols || 20,
    }
    setEditingFloorId(floor.id)
    floorModalInitialRef.current = buildFloorFormSignature(nextFloorForm)
    setFloorForm(nextFloorForm)
    setShowFloorModal(true)
  }

  const handleSaveFloor = async () => {
    if (!floorForm.name.trim()) {
      toast.error('Vui lòng nhập tên tầng.')
      return false
    }
    setSavingFloor(true)
    try {
      const payload = {
        name: floorForm.name.trim(),
        gridRows: Number(floorForm.gridRows) || 12,
        gridCols: Number(floorForm.gridCols) || 20,
      }
      if (editingFloorId) {
        const response = await axiosClient.put(`/api/asset-map/floors/${editingFloorId}`, payload)
        setShowFloorModal(false)
        floorModalInitialRef.current = buildFloorFormSignature(createDefaultFloorForm())
        applyFloorResponse(response.data, {
          preserveRoomShapes: true,
          selectFloor: true,
          keepSelection: true,
        })
        toast.success('Cập nhật tầng thành công.')
      } else {
        const response = await axiosClient.post('/api/asset-map/floors', {
          ...payload,
          mode: floorForm.mode || 'GRID',
        })
        setShowFloorModal(false)
        floorModalInitialRef.current = buildFloorFormSignature(createDefaultFloorForm())
        setFloors((previous) => [...previous, { ...response.data, roomShapes: response.data?.roomShapes || [] }])
        setActiveFloorId(response.data?.id)
        toast.success('Tạo tầng thành công.')
      }
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Lưu tầng thất bại.'
      toast.error(message)
      return false
    } finally {
      setSavingFloor(false)
    }
  }

  const handleDeleteFloor = async (floor) => {
    openConfirmDialog({
      title: 'Xóa tầng',
      message: `Bạn có chắc muốn xóa tầng "${floor.name}" không?`,
      confirmLabel: 'Xóa tầng',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setConfirmDialog((previous) => ({ ...previous, busy: true }))
          await axiosClient.delete(`/api/asset-map/floors/${floor.id}`)
          let fallbackFloorId = null
          setFloors((previous) => {
            const nextFloors = previous.filter((item) => Number(item.id) !== Number(floor.id))
            fallbackFloorId = nextFloors[0]?.id || null
            return nextFloors
          })
          setActiveFloorId((previous) => (Number(previous) === Number(floor.id) ? fallbackFloorId : previous))
          clearSelectedRooms()
          setCanvasContextMenu(null)
          setRoomContextMenu(null)
          toast.success('Xóa tầng thành công.')
          closeConfirmDialog()
        } catch (error) {
          const message = error?.response?.data?.message || 'Xóa tầng thất bại.'
          toast.error(message)
          setConfirmDialog((previous) => ({ ...previous, busy: false }))
        }
      },
    })
  }

  const handleCanvasResizeStart = (event, floor, handle) => {
    if (Number(floor.id) !== Number(activeFloorId) || floorInteractionMode !== 'view') return
    event.preventDefault()
    event.stopPropagation()
    const requiredSize = getRequiredCanvasSize(floor.roomShapes)
    setCanvasResizeState((previous) => ({
      ...previous,
      enabled: true,
      floorId: floor.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startRows: floor.gridRows || 12,
      startCols: floor.gridCols || 20,
      requiredRows: requiredSize.gridRows,
      requiredCols: requiredSize.gridCols,
    }))
  }

  const handleSaveCanvasSettings = async () => {
    const floorId = activeFloorId
    const saved = await persistCanvasSettings({
      floorId,
      gridRows: canvasForm.gridRows,
      gridCols: canvasForm.gridCols,
      canvasBackgroundColor: canvasForm.canvasBackgroundColor,
      successMessage: 'Đã cập nhật canvas của tầng.',
      closeModal: true,
    })
    if (saved) {
      canvasModalInitialRef.current = buildCanvasFormSignature(createDefaultCanvasForm())
    }
    return saved
  }

  const handleRoomClick = (event, floor, shape) => {
    event.preventDefault()
    const isToggleSelection = floorInteractionMode === 'view'
      && (event.metaKey || event.ctrlKey || event.shiftKey)
    const applySelection = () => {
      setActiveFloorId(floor.id)
      setRoomContextMenu(null)
      setCanvasContextMenu(null)

      if (floorInteractionMode === 'view' && drawTool === 'paint') {
        setSelectedRooms([shape.id], shape.id)
        void handlePaintColorChange(currentPaintColor, shape)
        return
      }

      if (isToggleSelection) {
        const normalizedShapeId = Number(shape.id)
        const nextIds = selectedShapeIdSet.has(normalizedShapeId)
          ? selectedShapeIds.filter((value) => Number(value) !== normalizedShapeId)
          : [...selectedShapeIds, normalizedShapeId]
        setSelectedRooms(nextIds, nextIds.length > 0 ? normalizedShapeId : null)
        return
      }

      setSelectedRooms([shape.id], shape.id)
    }

    if (Number(floor.id) !== Number(activeFloorId)) {
      requestGuardedAction(applySelection)
      return
    }

    applySelection()
  }

  const handleOpenRoomAssets = async (shape, floorId) => {
    const openAssetsModal = async () => {
      setActiveFloorId(floorId)
      setSelectedRooms([shape.id], shape.id)
      setShowRoomAssetsModal(true)
      setRoomAssets([])
      setRoomAssetsLoading(true)
      setRoomContextMenu(null)

      try {
        if (!shape.locationId) {
          setRoomAssets([])
          return
        }

        const response = await axiosClient.get('/api/asset-map/assets/search', {
          params: { locationId: shape.locationId, floorId },
        })
        setRoomAssets(response.data || [])
      } catch (error) {
        const message = error?.response?.data?.message || 'Không thể tải danh sách tài sản của phòng.'
        toast.error(message)
      } finally {
        setRoomAssetsLoading(false)
      }
    }

    if (Number(floorId) !== Number(activeFloorId)) {
      requestGuardedAction(() => {
        void openAssetsModal()
      })
      return
    }

    await openAssetsModal()
  }

  const handlePaintColorChange = async (nextColor, targetShape = selectedShape) => {
    setRoomDraft((previous) => ({ ...previous, colorHex: nextColor }))

    if (floorInteractionMode !== 'view' || !activeFloor || !targetShape) {
      return
    }

    const nextShapes = (activeFloor.roomShapes || []).map((shape) =>
      Number(shape.id) === Number(targetShape.id)
        ? { ...shape, colorHex: nextColor }
        : shape)

    const saved = await saveFloorSnapshot(
      {
        ...activeFloor,
        roomShapes: nextShapes,
      },
      'Đã cập nhật màu phòng.',
    )
    if (!saved) return
    clearDirtyFloor(activeFloor.id)
  }

  const handleDeleteActiveRegion = async () => {
    const imageFloor = isImageFloorMode(activeFloor)
    if (floorInteractionMode === 'add') {
      if (imageFloor) {
        if (!hasImageSelection) return
        handleClearSelection()
        return
      }
      if (selectedCells.size === 0) return
      handleClearSelection()
      return
    }

    if (floorInteractionMode === 'edit') {
      if (imageFloor) {
        if (!hasImageSelection) return
        setImageSelection(createDefaultImageSelection())
        return
      }
      if (selectedCells.size === 0) return
      setSelectedCells(new Set())
      return
    }

    if (floorInteractionMode === 'view' && selectedShape) {
      await handleRemoveShape(selectedShape)
    }
  }

  const handleRoomPointerDown = (event, floor, shape) => {
    if (drawTool !== 'move' || floorInteractionMode !== 'view') return
    if (event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    event.stopPropagation()
    const dragShapeIds = selectedShapeIdSet.has(Number(shape.id)) && selectedShapeIds.length > 0
      ? selectedShapeIds
      : [shape.id]
    const sourceShapes = (floor.roomShapes || [])
      .filter((item) => dragShapeIds.some((shapeId) => Number(shapeId) === Number(item.id)))
      .map((item) => ({
        id: item.id,
        cells: [...(item.cells || [])],
      }))
    if (sourceShapes.length === 0) return
    setActiveFloorId(floor.id)
    setSelectedRooms(dragShapeIds, shape.id)
    setRoomDragState({
      active: true,
      floorId: floor.id,
      shapeIds: dragShapeIds.map((value) => Number(value)),
      startX: event.clientX,
      startY: event.clientY,
      sourceShapes,
    })
  }

  const handleSaveRoomDraft = async () => {
    if (!activeFloor) return
    const editingShape = selectedShape
    const isShapeRedrawMode = floorInteractionMode === 'add' || floorInteractionMode === 'edit'
    const imageFloor = isImageFloorMode(activeFloor)
    const draftShapeId = editingShape ? editingShape.id : nextTempShapeId

    if (isShapeRedrawMode) {
      if (imageFloor) {
        if (!hasImageSelection || !imageSelectionGeometry.bounds) {
          toast.error('Hãy vẽ vùng trên ảnh trước khi tạo phòng.')
          return false
        }
      } else if (selectedCells.size === 0) {
        toast.error('Hãy chọn vùng ô vuông trước khi tạo phòng.')
        return false
      }
    }
    if (roomDraft.mode === 'existing' && !roomDraft.locationId) {
      toast.error('Vui lòng chọn phòng có sẵn.')
      return false
    }
    if (roomDraft.mode === 'new' && !roomDraft.roomName.trim()) {
      toast.error('Vui lòng nhập tên phòng.')
      return false
    }
    const areaTypePayload = buildAreaTypePayload(
      roomDraft.areaTypeKey,
      roomDraft.areaTypeLabel,
      areaTypeCatalogEntries,
      roomDraft.areaGroupLabel,
    )
    if (!areaTypePayload.areaTypeLabel) {
      toast.error('Vui lòng chọn hoặc nhập loại khu vực.')
      return false
    }

    const location = roomDraft.mode === 'existing'
      ? locations.find((item) => Number(item.id) === Number(roomDraft.locationId))
      : null
    const existingMappedShape = roomDraft.mode === 'existing'
      ? roomShapeByLocationId.get(Number(roomDraft.locationId))
      : null

    if (
      roomDraft.mode === 'existing'
      && existingMappedShape
      && Number(existingMappedShape.id) !== Number(editingShape?.id)
    ) {
      toast.error(`Phòng "${location?.roomName || existingMappedShape.roomName || ''}" đã có sơ đồ trên tầng. Hãy chọn phòng khác chưa được vẽ.`)
      return false
    }

    const nextShape = {
      id: draftShapeId,
      locationId: roomDraft.mode === 'existing' ? Number(roomDraft.locationId) : null,
      roomName: roomDraft.mode === 'existing' ? (location?.roomName || editingShape?.roomName || '') : roomDraft.roomName.trim(),
      cells: imageFloor
        ? []
        : isShapeRedrawMode
        ? Array.from(selectedCells).sort(compareCells)
        : [...(editingShape?.cells || [])].sort(compareCells),
      points: imageFloor
        ? (isShapeRedrawMode ? imageSelectionGeometry.points : (editingShape?.points || []))
        : [],
      bounds: imageFloor
        ? (isShapeRedrawMode ? imageSelectionGeometry.bounds : (editingShape?.bounds || null))
        : null,
      colorHex: roomDraft.colorHex || DEFAULT_COLOR,
      areaTypeKey: areaTypePayload.areaTypeKey,
      areaTypeLabel: areaTypePayload.areaTypeLabel,
    }

    const nextShapes = [...(activeFloor.roomShapes || [])]
    const index = nextShapes.findIndex((shape) => Number(shape.id) === Number(nextShape.id))
    if (index >= 0) {
      nextShapes[index] = nextShape
    } else {
      nextShapes.push(nextShape)
    }

    const saved = await saveFloorSnapshot(
      {
        ...activeFloor,
        roomShapes: nextShapes,
      },
      editingShape ? 'Đã cập nhật phòng trên sơ đồ.' : 'Đã tạo phòng mới trên sơ đồ.',
    )
    if (!saved) return false

    if (!editingShape) {
      setNextTempShapeId((previous) => previous - 1)
    }
    clearDirtyFloor(activeFloor.id)
    setShowRoomModal(false)
    roomModalInitialRef.current = buildRoomDraftSignature(createDefaultRoomDraft())
    setSelectedCells(new Set())
    setImageSelection(createDefaultImageSelection())
    setImageVertexDragState(createDefaultImageVertexDragState())
    await loadRoomAssetIndex()
    if (isShapeRedrawMode) {
      setFloorInteractionMode('view')
      setSelectionEnabled(false)
    }
    return true
  }

  const handleRemoveShape = async (shape = selectedShape) => {
    if (!activeFloor || !shape) return
    openConfirmDialog({
      title: 'Xóa vùng phòng',
      message: `Xóa vùng phòng "${shape.roomName}" khỏi sơ đồ? Phòng nghiệp vụ sẽ không bị xóa.`,
      confirmLabel: 'Xóa vùng',
      tone: 'danger',
      onConfirm: async () => {
        setConfirmDialog((previous) => ({ ...previous, busy: true }))
        const saved = await saveFloorSnapshot(
          {
            ...activeFloor,
            roomShapes: (activeFloor.roomShapes || []).filter((item) => Number(item.id) !== Number(shape.id)),
          },
          'Đã gỡ vùng phòng khỏi sơ đồ.',
        )
        if (!saved) {
          setConfirmDialog((previous) => ({ ...previous, busy: false }))
          return
        }

        clearDirtyFloor(activeFloor.id)
        clearSelectedRooms()
        setRoomContextMenu(null)
        setFloorInteractionMode('view')
        setSelectionEnabled(false)
        closeConfirmDialog()
      },
    })
  }

  const saveFloorLayouts = useCallback(async (floorIds, successMessage) => {
    setSavingLayout(true)
    try {
      const idsToSave = Array.from(new Set(floorIds.map((value) => Number(value)).filter(Boolean)))
      let lastSavedFloorId = activeFloorId

      for (const floorId of idsToSave) {
        const floor = floors.find((item) => Number(item.id) === Number(floorId))
        if (!floor) continue

        const response = await axiosClient.put(`/api/asset-map/floors/${floor.id}/layout`, {
          roomShapes: serializeRoomShapes(floor.roomShapes),
        })
        applyFloorResponse(response.data, {
          forceRoomShapes: response.data?.roomShapes || floor.roomShapes,
          selectFloor: Number(lastSavedFloorId) === Number(floor.id),
          keepSelection: true,
        })
        lastSavedFloorId = floor.id
      }
      if (successMessage) {
        toast.success(successMessage)
      }
      return true
    } catch (error) {
      const message = error?.response?.data?.message || 'Lưu sơ đồ thất bại.'
      toast.error(message)
      return false
    } finally {
      setSavingLayout(false)
    }
  }, [activeFloorId, applyFloorResponse, floors])

  const discardLocalDrafts = useCallback(() => {
    clearDragState()
    setSelectedCells(new Set())
    clearSelectedRooms()
    setShowRoomModal(false)
    setShowFloorModal(false)
    setShowCanvasModal(false)
    setCanvasResizeState({
      enabled: false,
      floorId: null,
      handle: null,
      startX: 0,
      startY: 0,
      startRows: 0,
      startCols: 0,
      requiredRows: 1,
      requiredCols: 1,
    })
    setImageSelection(createDefaultImageSelection())
    setRoomDraft(createDefaultRoomDraft())
    roomModalInitialRef.current = buildRoomDraftSignature(createDefaultRoomDraft())
    setFloorForm(createDefaultFloorForm())
    floorModalInitialRef.current = buildFloorFormSignature(createDefaultFloorForm())
    setCanvasForm(createDefaultCanvasForm())
    canvasModalInitialRef.current = buildCanvasFormSignature(createDefaultCanvasForm())
    setEditingFloorId(null)
    setFloorInteractionMode('view')
    setDrawTool(DEFAULT_DRAW_TOOL)
    setSelectionEnabled(false)
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomDragState({ active: false, floorId: null, shapeIds: [], startX: 0, startY: 0, sourceShapes: [] })
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setRoomPreview(null)
  }, [clearDragState, clearSelectedRooms])

  const handleClearSelection = useCallback(() => {
    setSelectedCells(new Set())
    setImageSelection(createDefaultImageSelection())
    setImageVertexDragState(createDefaultImageVertexDragState())
    if (floorInteractionMode === 'add') {
      clearSelectedRooms()
    }
    clearDragState()
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
  }, [clearDragState, clearSelectedRooms, floorInteractionMode])

  const handleSaveBeforeLeave = async () => {
    if (leaveActionBusy) return
    setLeaveActionBusy(true)

    try {
      if (roomDraftDirty) {
        const savedRoomDraft = await handleSaveRoomDraft()
        if (!savedRoomDraft) return
      }

      if (floorFormDirty) {
        const savedFloor = await handleSaveFloor()
        if (!savedFloor) return
      }

      if (canvasFormDirty) {
        const savedCanvas = await handleSaveCanvasSettings()
        if (!savedCanvas) return
      }

      if (selectedCells.size > 0) {
        toast.error('Vùng chọn hiện chưa được gán thành phòng nên chưa thể lưu. Hãy tạo phòng hoặc chọn Không lưu.')
        return
      }

      if (hasImageSelection && (floorInteractionMode === 'add' || floorInteractionMode === 'edit')) {
        toast.error('Vùng đang vẽ trên ảnh chưa được gán thành phòng nên chưa thể lưu. Hãy lưu phòng hoặc chọn Không lưu.')
        return
      }

      if (dirtyFloorIds.size > 0) {
        const savedLayouts = await saveFloorLayouts(
          Array.from(dirtyFloorIds),
          'Đã lưu các thay đổi trước khi rời trang.',
        )
        if (!savedLayouts) return
      }

      setShowLeavePrompt(false)
      if (pendingNavigationRef.current) {
        const nextUrl = pendingNavigationRef.current
        pendingNavigationRef.current = null
        bypassLeaveGuardRef.current = true
        navigate(nextUrl)
        window.setTimeout(() => {
          bypassLeaveGuardRef.current = false
        }, 0)
        return
      }
      runPendingAction()
    } finally {
      setLeaveActionBusy(false)
    }
  }

  const handleDiscardBeforeLeave = async () => {
    if (leaveActionBusy) return
    setLeaveActionBusy(true)

    try {
      discardLocalDrafts()
      setShowLeavePrompt(false)
      if (pendingNavigationRef.current) {
        const nextUrl = pendingNavigationRef.current
        pendingNavigationRef.current = null
        bypassLeaveGuardRef.current = true
        navigate(nextUrl)
        window.setTimeout(() => {
          bypassLeaveGuardRef.current = false
        }, 0)
        return
      }
      runPendingAction()
    } finally {
      setLeaveActionBusy(false)
    }
  }

  const handleConfirmDialogAccept = async () => {
    if (!confirmActionRef.current || confirmDialog.busy) return
    await confirmActionRef.current()
  }

  const handleSearch = useCallback(async (nextKeyword = searchFilters.keyword) => {
    setSearching(true)
    try {
      const params = {}
      if (String(nextKeyword || '').trim()) params.keyword = String(nextKeyword).trim()
      if (searchFilters.categoryId) params.categoryId = Number(searchFilters.categoryId)
      if (searchFilters.floorId) params.floorId = Number(searchFilters.floorId)
      if (searchFilters.locationId) params.locationId = Number(searchFilters.locationId)
      const response = await axiosClient.get('/api/asset-map/assets/search', { params })
      const nextResults = response.data || []
      setSearchResults(nextResults)
      if (nextResults[0]?.floorId) {
        const firstFloorId = nextResults[0].floorId
        setActiveFloorId(firstFloorId)
        window.setTimeout(() => {
          scrollToFloor(firstFloorId)
        }, 120)
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tìm tài sản trên sơ đồ.'
      toast.error(message)
    } finally {
      setSearching(false)
    }
  }, [scrollToFloor, searchFilters.categoryId, searchFilters.floorId, searchFilters.keyword, searchFilters.locationId])

  const handleResetSearch = () => {
    setSearchFilters({
      keyword: '',
      categoryId: '',
      floorId: '',
      locationId: '',
    })
    setSearchResults([])
  }

  useDebouncedEffect(() => {
    const hasSearchFilter = [
      searchFilters.keyword,
      searchFilters.categoryId,
      searchFilters.floorId,
      searchFilters.locationId,
    ].some((value) => String(value || '').trim())

    if (!hasSearchFilter) {
      setSearchResults([])
      return
    }

    void handleSearch()
  }, [searchFilters.keyword, searchFilters.categoryId, searchFilters.floorId, searchFilters.locationId], 300, true)

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      if (isScanningRef.current) {
        await scanner.stop()
      }
      await scanner.clear()
    } catch {
      // ignore scanner cleanup failures
    } finally {
      isScanningRef.current = false
      scannerRef.current = null
    }
  }, [])

  const startScanner = useCallback(async () => {
    if (isScanningRef.current) return
    const scanner = new Html5Qrcode(scannerElementId)
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          const qaCode = extractQaCode(decodedText)
          await stopScanner()
          setScannerOpen(false)
          setSearchFilters((previous) => ({ ...previous, keyword: qaCode }))
          await handleSearch(qaCode)
        },
        () => {},
      )
      isScanningRef.current = true
    } catch {
      toast.error('Khong the mo camera. Hay cap quyen truy cap camera.')
    }
  }, [handleSearch, stopScanner])

  useEffect(() => {
    if (!scannerOpen) {
      void stopScanner()
      return undefined
    }
    void startScanner()
    return () => {
      void stopScanner()
    }
  }, [scannerOpen, startScanner, stopScanner])

  useEffect(() => {
    if (!markerTooltip && !roomPreview) return undefined

    const hideTooltip = () => {
      setMarkerTooltip(null)
      setRoomPreview(null)
    }

    window.addEventListener('scroll', hideTooltip, true)
    window.addEventListener('resize', hideTooltip)
    return () => {
      window.removeEventListener('scroll', hideTooltip, true)
      window.removeEventListener('resize', hideTooltip)
    }
  }, [markerTooltip, roomPreview])

  const handleMarkerTooltipShow = useCallback((event, asset) => {
    const nextPosition = calculateFloatingCardPosition(event.currentTarget.getBoundingClientRect())
    setMarkerTooltip({
      asset,
      ...nextPosition,
    })
  }, [])

  const handleMarkerTooltipHide = useCallback((asset) => {
    setMarkerTooltip((previous) => (previous?.asset?.qaCode === asset.qaCode ? null : previous))
  }, [])

  const handleRoomPreviewShow = useCallback((event, shape) => {
    const assetCount = roomAssetCountMap.get(shape?.locationId) || 0
    const nextPosition = calculateFloatingCardPosition(event.currentTarget.getBoundingClientRect(), {
      width: 280,
      height: 176,
      offset: 14,
    })
    setRoomPreview({
      shape,
      assetCount,
      areaType: resolveAreaTypeMeta(shape, areaTypeCatalogEntries),
      syncMeta: getRoomSyncMeta(shape, locations),
      ...nextPosition,
    })
  }, [locations, roomAssetCountMap])

  const handleRoomPreviewHide = useCallback((shape) => {
    setRoomPreview((previous) => (previous?.shape?.id === shape?.id ? null : previous))
  }, [])

  const handleSearchFilterChange = useCallback((patch) => {
    setSearchFilters((previous) => ({ ...previous, ...patch }))
  }, [])

  const handleRoomDraftChange = useCallback((patch) => {
    setRoomDraft((previous) => ({ ...previous, ...patch }))
  }, [])

  const handleSelectFloor = useCallback((floorId, { scroll = false } = {}) => {
    if (!floorId) return
    const applySelection = () => {
      setActiveFloorId(floorId)
      setRoomContextMenu(null)
      setCanvasContextMenu(null)
      if (scroll) {
        scrollToFloor(floorId)
      }
    }
    if (Number(floorId) === Number(activeFloorId)) {
      applySelection()
      return
    }
    requestGuardedAction(applySelection)
  }, [activeFloorId, requestGuardedAction, scrollToFloor])

  const handleJumpToAssetFloor = useCallback((floorId) => {
    handleSelectFloor(floorId, { scroll: true })
  }, [handleSelectFloor])

  const handleOpenCreateFloorModal = useCallback(() => {
    captureHistoryBoundary()
    requestGuardedAction(() => {
      openCreateFloorModal()
    })
  }, [captureHistoryBoundary, requestGuardedAction])

  const handleOpenEditFloorModal = useCallback((floor) => {
    captureHistoryBoundary()
    requestGuardedAction(() => {
      openEditFloorModal(floor)
    })
  }, [captureHistoryBoundary, requestGuardedAction])

  const handleBeginAddRoomMode = useCallback((floorId) => {
    captureHistoryBoundary()
    requestGuardedAction(() => {
      beginAddRoomMode(floorId)
    })
  }, [beginAddRoomMode, captureHistoryBoundary, requestGuardedAction])

  const handleBeginEditRoomMode = useCallback((shape, floorId) => {
    captureHistoryBoundary()
    requestGuardedAction(() => {
      beginEditRoomMode(shape, floorId)
    })
  }, [beginEditRoomMode, captureHistoryBoundary, requestGuardedAction])

  const handleOpenRoomInfoModal = useCallback((shape, floorId) => {
    captureHistoryBoundary()
    requestGuardedAction(() => {
      openRoomInfoModal(shape, floorId)
    })
  }, [captureHistoryBoundary, openRoomInfoModal, requestGuardedAction])

  const handleExitInteractionMode = useCallback((keepSelectedShape = true) => {
    requestGuardedAction(() => {
      exitInteractionMode(keepSelectedShape)
    })
  }, [exitInteractionMode, requestGuardedAction])

  const handleCloseRoomModal = useCallback(() => {
    requestGuardedAction(() => {
      setShowRoomModal(false)
    })
  }, [requestGuardedAction])

  const handleCloseFloorModal = useCallback(() => {
    requestGuardedAction(() => {
      setShowFloorModal(false)
    })
  }, [requestGuardedAction])

  const handleCloseCanvasModal = useCallback(() => {
    requestGuardedAction(() => {
      setShowCanvasModal(false)
    })
  }, [requestGuardedAction])

  const handleQuickSelectionSave = useCallback(() => {
    if (floorInteractionMode === 'view' && selectedShape) {
      handleOpenRoomInfoModal(selectedShape, activeFloorId)
      return
    }
    openRoomDraftModal(selectedShape)
  }, [activeFloorId, floorInteractionMode, handleOpenRoomInfoModal, openRoomDraftModal, selectedShape])

  const handleQuickSelectionCancel = useCallback(() => {
    if (floorInteractionMode === 'view') {
      clearSelectedRooms()
      return
    }
    handleExitInteractionMode(floorInteractionMode === 'edit')
  }, [clearSelectedRooms, floorInteractionMode, handleExitInteractionMode])

  useEffect(() => {
    if (floorInteractionMode !== 'view' || selectedShapeIds.length === 0) {
      return undefined
    }

    const handleGlobalPointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      if (target.closest('[data-asset-map-keep-selection="true"]')) return
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) return

      clearSelectedRooms()
    }

    window.addEventListener('pointerdown', handleGlobalPointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown, true)
    }
  }, [clearSelectedRooms, floorInteractionMode, selectedShapeIds.length])

  const handleQuickSelectionColorChange = useCallback((nextColor) => {
    if (floorInteractionMode === 'view') {
      void handlePaintColorChange(nextColor, selectedShape)
      return
    }
    handleRoomDraftChange({ colorHex: nextColor })
  }, [floorInteractionMode, handlePaintColorChange, handleRoomDraftChange, selectedShape])

  const handleQuickSelectionEditInfo = useCallback(() => {
    if (!selectedShape) return
    handleOpenRoomInfoModal(selectedShape, activeFloorId)
  }, [activeFloorId, handleOpenRoomInfoModal, selectedShape])

  const handleQuickSelectionEditLayout = useCallback(() => {
    if (!selectedShape) return
    handleBeginEditRoomMode(selectedShape, activeFloorId)
  }, [activeFloorId, handleBeginEditRoomMode, selectedShape])

  const handleQuickSelectionOpenAssets = useCallback(() => {
    if (!selectedShape) return
    void handleOpenRoomAssets(selectedShape, activeFloorId)
  }, [activeFloorId, handleOpenRoomAssets, selectedShape])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <div className="h-6 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes asset-map-ping {
          0% { transform: scale(0.9); opacity: 0.85; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sơ đồ định vị tài sản</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Admin tự vẽ sơ đồ theo dạng grid, merge nhiều ô để tạo phòng, thêm tầng mới và tìm tài sản trực tiếp trên mặt bằng.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/locations/area-types')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronDown size={16} />
              Loại khu vực
            </button>
            <button
              type="button"
              onClick={() => setShowImageImportModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload size={16} />
              Import ảnh
            </button>
            <button
              type="button"
              onClick={handleUndo}
              disabled={!historyMeta.canUndo}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Hoàn tác
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!historyMeta.canRedo}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Làm lại
            </button>
            <button
              type="button"
              onClick={() => loadBootstrap(activeFloorId)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Refresh size={16} />
              Tải lại
            </button>
          </div>
        </div>
      </div>

      <div className={`grid items-start gap-4 ${
        isToolbarCollapsed
          ? 'xl:grid-cols-[minmax(0,1fr)_0px]'
          : 'xl:grid-cols-[minmax(0,1fr)_92px] 2xl:grid-cols-[minmax(0,1fr)_minmax(248px,304px)]'
      }`}
      >
        <div className="min-w-0 space-y-4">
          {!activeFloor && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Chưa có tầng đang hoạt động</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Hãy chọn một tầng hoặc tạo tầng mới để bắt đầu.</p>
              <button
                type="button"
                onClick={handleOpenCreateFloorModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fptOrange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-fptOrangeDark"
              >
                Thêm tầng
              </button>
            </div>
          )}

          {activeFloor && (
            <div
              id={`asset-map-floor-${activeFloor.id}`}
              className="rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{activeFloor.name}</h3>
                    {dirtyFloorIds.has(activeFloor.id) && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Chưa lưu
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAssetSearchModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Search size={16} />
                      Tìm tài sản
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {isImageFloorMode(activeFloor)
                      ? `Ảnh nền ${activeFloor.imageWidth || '?'} x ${activeFloor.imageHeight || '?'} · ${(activeFloor.roomShapes || []).length} khu vực`
                      : `Grid ${activeFloor.gridRows} x ${activeFloor.gridCols} · ${(activeFloor.roomShapes || []).length} khu vực`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    surfaceMode.key === 'assign'
                      ? 'bg-orange-100 text-orange-700'
                      : surfaceMode.key === 'layout'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  }`}
                  >
                    {surfaceMode.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Hiển thị {visibleShapeIdSet.size}/{(activeFloor.roomShapes || []).length} khu vực
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsToolbarCollapsed((previous) => !previous)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isToolbarCollapsed ? 'Mở công cụ' : 'Đóng công cụ'}
                  </button>
                </div>
              </div>

              <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(260px,360px)_minmax(220px,1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Chọn tầng
                  </p>
                  <div className="mt-2">
                    <SearchableSelect
                      value={activeFloorId}
                      onChange={(nextValue) => handleSelectFloor(String(nextValue || ''))}
                      options={floors}
                      placeholder="Gõ để tìm tầng"
                      disabled={floors.length === 0}
                      getOptionValue={(floor) => floor.id}
                      getOptionLabel={(floor) => floor.name}
                      getOptionDescription={(floor) => (
                        isImageFloorMode(floor)
                          ? `Ảnh nền · ${(floor.roomShapes || []).length} khu vực`
                          : `Grid ${floor.gridRows} x ${floor.gridCols} · ${(floor.roomShapes || []).length} khu vực`
                      )}
                      getOptionSearchText={(floor) => [
                        floor?.name,
                        isImageFloorMode(floor) ? 'image ảnh nền' : 'grid',
                        floor?.gridRows,
                        floor?.gridCols,
                      ].filter(Boolean).join(' ')}
                      renderOption={(option) => {
                        const floor = option.original
                        const isImageFloor = isImageFloorMode(floor)
                        return (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-700 dark:text-slate-100">{option.label}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isImageFloor
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                            }`}
                            >
                              {isImageFloor ? 'IMAGE' : 'GRID'}
                            </span>
                          </div>
                        )
                      }}
                      inputClassName="rounded-xl border-slate-300 bg-white py-2.5 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Phòng đang chọn
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {selectedRoomSummary ? selectedRoomSummary.name : 'Chưa chọn phòng'}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.4rem] border-2 border-slate-300 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/60">
                <MapCanvas
                  floor={activeFloor}
                  isActive
                  isImageFloor={isImageFloorMode(activeFloor)}
                  isFloorEditing={floorInteractionMode === 'edit'}
                  selectedShapeId={selectionState.selectedShapeId}
                  selectedShapeIdSet={selectedShapeIdSet}
                  selectedShapes={selectionState.selectedShapes}
                  selectedCells={selectionState.selectedCells}
                  editableShapeId={editableShapeId}
                  drawTool={viewState.drawTool}
                  floorInteractionMode={viewState.floorInteractionMode}
                  roomDragState={selectionState.roomDragState}
                  cellShapeMap={cellShapeMaps[activeFloor.id] || new Map()}
                  searchResultMap={searchResultMap}
                  showGridLines={showGridLines}
                  canvasResizeState={draftState.canvasResizeState}
                  roomDraft={draftState.roomDraft}
                  imageSelection={selectionState.imageSelection}
                  imageSelectionGeometry={selectionState.imageSelectionGeometry}
                  imageVertexDragState={selectionState.imageVertexDragState}
                  imageSvgRef={imageSvgRef}
                  cellSize={CELL_SIZE}
                  defaultColor={DEFAULT_COLOR}
                  getShapePoints={getShapePoints}
                  buildImageBoundsFromPoints={buildImageBoundsFromPoints}
                  getShapeCenter={getShapeCenter}
                  getShapeBounds={getShapeBounds}
                  getReadableTextColor={getReadableTextColor}
                  colorWithAlpha={colorWithAlpha}
                  pointsToSvgValue={pointsToSvgValue}
                  getMarkerOffsets={getMarkerOffsets}
                  visibleShapeIdSet={visibleShapeIdSet}
                  selectionBounds={currentSelectionBounds}
                  showFloatingSelectionToolbar={showFloatingSelectionToolbar}
                  quickSelectionColor={currentPaintColor}
                  onQuickSelectionSave={handleQuickSelectionSave}
                  onQuickSelectionCancel={handleQuickSelectionCancel}
                  onQuickSelectionDelete={() => { void handleDeleteActiveRegion() }}
                  onQuickSelectionBind={() => openRoomDraftModal(selectedShape)}
                  onQuickSelectionEditInfo={handleQuickSelectionEditInfo}
                  onQuickSelectionEditLayout={handleQuickSelectionEditLayout}
                  onQuickSelectionMove={() => setActiveDrawTool('move')}
                  onQuickSelectionOpenAssets={handleQuickSelectionOpenAssets}
                  onQuickSelectionPaintMode={() => setActiveDrawTool('paint')}
                  HandToolIcon={HandToolIcon}
                  PaintToolIcon={PaintToolIcon}
                  onQuickSelectionColorChange={handleQuickSelectionColorChange}
                  onImagePointerDown={handleImagePointerDown}
                  onImagePointerMove={handleImagePointerMove}
                  onImagePointerUp={handleImagePointerUp}
                  onImageCanvasClick={handleImageCanvasClick}
                  onImageVertexPointerDown={handleImageVertexPointerDown}
                  onCanvasResizeStart={handleCanvasResizeStart}
                  onCellPointerDown={handleCellPointerDown}
                  onCellPointerEnter={handleCellPointerEnter}
                  onCellPointerUp={handleCellPointerUp}
                  onRoomPointerDown={handleRoomPointerDown}
                  onRoomClick={handleRoomClick}
                  onRoomPreviewShow={handleRoomPreviewShow}
                  onRoomPreviewHide={handleRoomPreviewHide}
                  onMarkerTooltipShow={handleMarkerTooltipShow}
                  onMarkerTooltipHide={handleMarkerTooltipHide}
                  showCanvasGrid={showCanvasGrid}
                  snapEnabled={snapEnabled}
                  onToggleCanvasGrid={() => setShowCanvasGrid((previous) => !previous)}
                  onToggleSnap={() => setSnapEnabled((previous) => !previous)}
                />
              </div>
            </div>
          )}
        </div>

        <aside className="relative z-30 min-w-0 overflow-visible">
          <div className="sticky top-4 overflow-visible">
            {activeFloor && (
              <div className={`relative z-30 ml-auto w-full max-w-[304px] overflow-visible transition-all duration-300 ease-out xl:max-w-[272px] 2xl:max-w-[304px] ${
                isToolbarCollapsed
                  ? 'translate-x-full opacity-0 pointer-events-none'
                  : 'translate-x-0 opacity-100'
              }`}
              >
                <FloorToolbar
                  isImageFloor={isImageFloorMode(activeFloor)}
                  isActive
                  floorInteractionMode={viewState.floorInteractionMode}
                  drawTool={viewState.drawTool}
                  selectedRoom={selectedRoomSummary}
                  selectedCellsSize={selectionState.selectedCells.size}
                  hasImageSelection={hasImageSelection}
                  savingLayout={serverState.savingLayout}
                  currentPaintColor={currentPaintColor}
                  MouseToolIcon={MouseToolIcon}
                  HandToolIcon={HandToolIcon}
                  PaintToolIcon={PaintToolIcon}
                  imageRectangleTool={IMAGE_RECTANGLE_TOOL}
                  imagePolygonTool={IMAGE_POLYGON_TOOL}
                  onCreateFloor={handleOpenCreateFloorModal}
                  onAddRoom={() => handleBeginAddRoomMode(activeFloor.id)}
                  onEditFloor={() => handleOpenEditFloorModal(activeFloor)}
                  onDeleteFloor={() => handleDeleteFloor(activeFloor)}
                  onSetDrawTool={setActiveDrawTool}
                  onClearSelection={() => {
                    if (viewState.floorInteractionMode === 'view') {
                      clearSelectedRooms()
                      return
                    }
                    handleClearSelection()
                  }}
                  onDeleteActiveRegion={() => { void handleDeleteActiveRegion() }}
                  onFinishImagePolygon={finishImagePolygon}
                  onOpenRoomDraft={() => openRoomDraftModal(selectedShape)}
                  onExitInteractionMode={() => handleExitInteractionMode(viewState.floorInteractionMode === 'edit')}
                  onPaintColorChange={(nextColor) => { void handlePaintColorChange(nextColor) }}
                  onEditSelectedRoom={handleQuickSelectionEditInfo}
                  onEditSelectedLayout={handleQuickSelectionEditLayout}
                  onOpenSelectedAssets={handleQuickSelectionOpenAssets}
                  onMoveSelected={() => setActiveDrawTool('move')}
                  onPaintSelected={() => setActiveDrawTool('paint')}
                  onSelectedColorChange={handleQuickSelectionColorChange}
                />
              </div>
            )}
          </div>
        </aside>
      </div>

      <AssetPlacementPanel
        categories={serverState.categories}
        floors={serverState.floors}
        filteredLocationOptions={filteredLocationOptions}
        searchFilters={searchFilters}
        searchResults={serverState.searchResults}
        searching={viewState.searching}
        showSearchModal={showAssetSearchModal}
        onSearchFilterChange={handleSearchFilterChange}
        onCloseSearchModal={() => setShowAssetSearchModal(false)}
        onOpenScanner={() => {
          setShowAssetSearchModal(false)
          setScannerOpen(true)
        }}
        onSearch={() => { void handleSearch() }}
        onResetSearch={handleResetSearch}
        onJumpToAssetFloor={handleJumpToAssetFloor}
      />

      {markerTooltip && (
        <div
          className="pointer-events-none fixed z-40 w-56 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs text-white shadow-2xl"
          style={{
            left: markerTooltip.left,
            top: markerTooltip.top,
            transform: markerTooltip.placement === 'top'
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
          }}
        >
          <p className="font-semibold">{markerTooltip.asset.name}</p>
          <p className="mt-1 text-slate-200">QA: {markerTooltip.asset.qaCode}</p>
          <p className="text-slate-300">Phòng: {markerTooltip.asset.locationName}</p>
          <p className="text-slate-300">Loại: {markerTooltip.asset.categoryName}</p>
        </div>
      )}

      {roomPreview && (
        <div
          className="pointer-events-none fixed z-40 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left: roomPreview.left,
            top: roomPreview.top,
            transform: roomPreview.placement === 'top'
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{roomPreview.shape.roomName || 'Khu vực chưa đặt tên'}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {roomPreview.assetCount} tài sản gắn với phòng này
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${roomPreview.syncMeta.tone}`}>
              {roomPreview.syncMeta.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
              <p className="text-slate-500 dark:text-slate-400">Loại khu vực</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{roomPreview.areaType.label}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
              <p className="text-slate-500 dark:text-slate-400">Màu</p>
              <div className="mt-1 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                <span
                  className="h-3 w-3 rounded-full border border-white/70 shadow"
                  style={{ backgroundColor: roomPreview.shape.colorHex || DEFAULT_COLOR }}
                />
                {String(roomPreview.shape.colorHex || DEFAULT_COLOR).toUpperCase()}
              </div>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
              <p className="text-slate-500 dark:text-slate-400">Đồng bộ</p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{roomPreview.syncMeta.label}</p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {roomPreview.areaType.description}
          </p>
        </div>
      )}

      {showImageImportModal && (
        <ImportSessionPanel
          importSubmitting={serverState.importSubmitting}
          importApplying={serverState.importApplying}
          imageImportSession={draftState.imageImportSession}
          selectedImportDrawingIds={draftState.selectedImportDrawingIds}
          onClose={closeImageImportModal}
          onFileChange={handleImageImportFileChange}
          onToggleDrawing={handleToggleImportDrawing}
          onApply={() => { void handleApplyImageImport() }}
        />
      )}

      {showFloorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingFloorId ? 'Cập nhật tầng' : 'Thêm tầng mới'}
              </h3>
              <button
                type="button"
                onClick={handleCloseFloorModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên tầng</label>
                <input
                  value={floorForm.name}
                  onChange={(event) => setFloorForm((previous) => ({ ...previous, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              {floorForm.mode !== 'IMAGE' && (
                <>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Số hàng grid</label>
                      <div className="group relative">
                        <button
                          type="button"
                          className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <InfoCircle size={16} />
                        </button>
                        <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-56 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block">
                          Số hàng grid là số ô theo chiều dọc của mặt bằng. Tăng giá trị này khi bạn muốn chia tầng thành nhiều hàng hơn.
                        </div>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="4"
                      max="100"
                      value={floorForm.gridRows}
                      onChange={(event) => setFloorForm((previous) => ({ ...previous, gridRows: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Số cột grid</label>
                      <div className="group relative">
                        <button
                          type="button"
                          className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <InfoCircle size={16} />
                        </button>
                        <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-56 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block">
                          Số cột grid là số ô theo chiều ngang của mặt bằng. Tăng giá trị này khi bạn cần sơ đồ rộng hơn để chia nhiều phòng hơn.
                        </div>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="4"
                      max="100"
                      value={floorForm.gridCols}
                      onChange={(event) => setFloorForm((previous) => ({ ...previous, gridCols: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleSaveFloor}
                disabled={savingFloor}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                {editingFloorId ? 'Lưu tầng' : 'Tạo tầng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCanvasModal && activeFloor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tùy chỉnh canvas</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Cập nhật màu nền hoặc kích thước canvas cho {activeFloor.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseCanvasModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCanvasModalMode('color')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  canvasModalMode === 'color'
                    ? 'bg-orange-100 text-orange-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Đổi màu nền
              </button>
              <button
                type="button"
                onClick={() => setCanvasModalMode('size')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  canvasModalMode === 'size'
                    ? 'bg-orange-100 text-orange-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Đổi kích thước
              </button>
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Màu nền canvas</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={canvasForm.canvasBackgroundColor}
                    onChange={(event) => setCanvasForm((previous) => ({ ...previous, canvasBackgroundColor: event.target.value }))}
                    className="h-12 w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300">
                    {canvasForm.canvasBackgroundColor}
                  </span>
                </div>
                {canvasColorConflict && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">
                    Màu nền {normalizeHexColor(canvasForm.canvasBackgroundColor, '#FFFFFF')} quá giống với màu của khu vực{' '}
                    <span className="font-semibold">{canvasColorConflict.shape?.roomName || 'đang có'}</span>{' '}
                    ({canvasColorConflict.colorHex}). Hãy chọn màu khác để các phòng còn nhìn rõ trên bản đồ.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Số hàng canvas</label>
                    <input
                      type="number"
                      min="4"
                      max="100"
                      value={canvasForm.gridRows}
                      onChange={(event) => setCanvasForm((previous) => ({ ...previous, gridRows: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Số cột canvas</label>
                    <input
                      type="number"
                      min="4"
                      max="100"
                      value={canvasForm.gridCols}
                      onChange={(event) => setCanvasForm((previous) => ({ ...previous, gridCols: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <p>
                    Canvas phải đủ chứa toàn bộ phòng hiện có. Nếu bạn nhập kích thước nhỏ hơn phạm vi phòng đang vẽ,
                    hệ thống sẽ không cho lưu.
                  </p>
                  <p className="mt-2">
                    Khi canvas rộng hơn khung hiển thị, trang sẽ tự xuất hiện thanh trượt ngang để tránh vỡ layout.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseCanvasModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCanvasSettings}
                disabled={Boolean(canvasColorConflict)}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-60"
              >
                Lưu canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoomModal && (
        <RoomEditorModal
          selectedShape={selectedShape}
          floorInteractionMode={viewState.floorInteractionMode}
          roomDraft={draftState.roomDraft}
          locations={serverState.locations}
          locationOptionsForRoomModal={locationOptionsForRoomModal}
          areaTypeOptions={areaTypeOptions}
          areaTypePresets={areaTypeCatalogEntries}
          roomShapeByLocationId={roomShapeByLocationId}
          onClose={handleCloseRoomModal}
          onRoomDraftChange={handleRoomDraftChange}
          onSave={() => { void handleSaveRoomDraft() }}
        />
      )}

      {showRoomAssetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Danh sách tài sản trong phòng {selectedShape?.roomName || ''}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Hiển thị các tài sản hiện đang định vị tại phòng được chọn trên sơ đồ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRoomAssetsModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-[180px_minmax(0,1.6fr)_1fr_1fr] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <span>QA Code</span>
                <span>Tên tài sản</span>
                <span>Loại</span>
                <span>Trạng thái</span>
              </div>
              <div className="max-h-[420px] overflow-auto divide-y divide-slate-200 dark:divide-slate-800">
                {roomAssetsLoading && (
                  <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách tài sản...</div>
                )}
                {!roomAssetsLoading && roomAssets.length === 0 && (
                  <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Phòng này hiện chưa có tài sản nào đang định vị.</div>
                )}
                {!roomAssetsLoading && roomAssets.map((asset) => (
                  <div
                    key={asset.qaCode}
                    className="grid grid-cols-[180px_minmax(0,1.6fr)_1fr_1fr] px-4 py-3 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <span className="font-semibold">{asset.qaCode}</span>
                    <span>{asset.name}</span>
                    <span>{asset.categoryName || 'Chưa rõ'}</span>
                    <span>{asset.status || asset.technicalStatus || asset.usageStatus || 'Chưa rõ'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Quét QR tài sản</h3>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
            <div id={scannerElementId} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Sau khi quét thành công, hệ thống sẽ tự tìm tài sản và nhảy tới tầng tương ứng trên sơ đồ.
            </p>
          </div>
        </div>
      )}

      {showLeavePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Bạn đang có thay đổi chưa lưu
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {unsavedMessage}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Bạn có muốn lưu trước khi rời khỏi trang này không?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleDiscardBeforeLeave}
                disabled={leaveActionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Không lưu
              </button>
              <button
                type="button"
                onClick={handleSaveBeforeLeave}
                disabled={leaveActionBusy}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-60"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {confirmDialog.title}
                </h3>
                {confirmDialog.message && (
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {confirmDialog.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={confirmDialog.busy}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={confirmDialog.busy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDialogAccept}
                disabled={confirmDialog.busy}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-fptOrange hover:bg-fptOrangeDark'
                }`}
              >
                {confirmDialog.busy ? 'Đang xử lý...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetMapManagement
