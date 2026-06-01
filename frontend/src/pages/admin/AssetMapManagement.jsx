import {
  IconArrowsMove as Move,
  IconCamera as Camera,
  IconChevronDown as ChevronDown,
  IconChevronUp as ChevronUp,
  IconDeviceFloppy as Save,
  IconEdit as Edit,
  IconListDetails as ListDetails,
  IconPlus as Plus,
  IconRefresh as Refresh,
  IconSearch as Search,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react'
import { Html5Qrcode } from 'html5-qrcode'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBeforeUnload, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axiosClient from '../../api/axiosClient'

const CELL_SIZE = 32
const DEFAULT_COLOR = '#F97316'
const scannerElementId = 'asset-map-qr-scanner'
const DEFAULT_DRAW_TOOL = 'select'

function createDefaultFloorForm() {
  return {
    name: '',
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
    hasAsset: true,
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
  const cells = Array.isArray(shape?.cells) ? shape.cells.map(parseCell) : []
  if (cells.length === 0) {
    return { left: CELL_SIZE / 2, top: CELL_SIZE / 2 }
  }
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

function buildShapeOptionLabel(shape, locations) {
  if (shape.locationId) {
    const location = locations.find((item) => item.id === shape.locationId)
    return location?.roomName || shape.roomName || 'Phòng đã gán'
  }
  return shape.roomName || 'Phòng mới chưa lưu'
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

function calculateMarkerTooltipPosition(targetRect) {
  const tooltipWidth = 224
  const tooltipHeight = 108
  const viewportPadding = 12
  const centeredLeft = targetRect.left + targetRect.width / 2
  const canShowAbove = targetRect.top >= tooltipHeight + 20

  let left = centeredLeft
  let top = canShowAbove ? targetRect.top - 10 : targetRect.bottom + 10

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

function serializeRoomShapes(roomShapes) {
  return (roomShapes || []).map((shape) => ({
    id: Number(shape.id) > 0 ? shape.id : null,
    locationId: shape.locationId || null,
    roomName: shape.roomName || '',
    cells: [...(shape.cells || [])].sort(compareCells),
    colorHex: shape.colorHex || DEFAULT_COLOR,
    hasAsset: shape.hasAsset !== false,
  }))
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
  const bypassLeaveGuardRef = useRef(false)
  const contextMenuRef = useRef(null)
  const confirmActionRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [floors, setFloors] = useState([])
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])
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
  })
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [savingFloor, setSavingFloor] = useState(false)
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [editingFloorId, setEditingFloorId] = useState(null)
  const [floorForm, setFloorForm] = useState(createDefaultFloorForm)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [canvasModalMode, setCanvasModalMode] = useState('color')
  const [canvasForm, setCanvasForm] = useState(createDefaultCanvasForm)
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
  const [notesCollapsed, setNotesCollapsed] = useState(true)
  const [roomsCollapsed, setRoomsCollapsed] = useState(true)
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
  const [roomAssetsLoading, setRoomAssetsLoading] = useState(false)
  const [roomAssets, setRoomAssets] = useState([])
  const [markerTooltip, setMarkerTooltip] = useState(null)
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
      if (roomDraft.mode === 'existing' && floorInteractionMode === 'add' && mappedLocationIds.has(Number(location.id))) {
        return false
      }
      if (!activeFloorId) return true
      return Number(location.floorId) === Number(activeFloorId)
    })
  }, [activeFloorId, floorInteractionMode, floors, locations, roomDraft.mode, selectedShapeId])

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

  const hasUnsavedChanges = useMemo(
    () =>
      dirtyFloorIds.size > 0
      || selectedCells.size > 0
      || showRoomModal
      || showFloorModal
      || showCanvasModal
      || Boolean(canvasResizeState.handle)
      || isDraggingSelection
      || floorInteractionMode !== 'view',
    [canvasResizeState.handle, dirtyFloorIds, floorInteractionMode, isDraggingSelection, selectedCells, showCanvasModal, showFloorModal, showRoomModal],
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
    if (showRoomModal) {
      return 'Bạn đang tạo hoặc chỉnh sửa phòng trên sơ đồ. Nếu rời trang lúc này, thông tin phòng đang nhập có thể bị mất.'
    }
    if (showFloorModal) {
      return 'Bạn đang tạo hoặc chỉnh sửa tầng. Nếu rời trang lúc này, thay đổi của tầng có thể chưa được lưu.'
    }
    if (showCanvasModal) {
      return 'Bạn đang chỉnh màu nền hoặc kích thước canvas. Nếu rời trang lúc này, thay đổi của canvas có thể chưa được lưu.'
    }
    if (selectedCells.size > 0) {
      return 'Bạn đang có vùng chọn tạo phòng chưa hoàn tất. Nếu rời trang lúc này, vùng chọn sẽ bị mất.'
    }
    if (dirtyFloorIds.size > 0) {
      return 'Bạn đang có thay đổi sơ đồ chưa lưu. Nếu rời trang lúc này, các phòng vừa tạo hoặc chỉnh sửa có thể bị mất.'
    }
    return 'Bạn đang có thao tác chưa lưu. Nếu rời trang lúc này, dữ liệu có thể bị mất.'
  }, [canvasResizeState.handle, dirtyFloorIds.size, floorInteractionMode, selectedCells.size, showCanvasModal, showFloorModal, showRoomModal])

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

  const loadBootstrap = useCallback(async (preferredFloorId = null) => {
    setLoading(true)
    try {
      const response = await axiosClient.get('/api/asset-map/bootstrap')
      const nextFloors = response.data?.floors || []
      setFloors(nextFloors)
      setLocations(response.data?.locations || [])
      setCategories(response.data?.categories || [])
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
      setEditingFloorId(null)
      setFloorForm(createDefaultFloorForm())
      setShowCanvasModal(false)
      setCanvasContextMenu(null)
      setCanvasForm(createDefaultCanvasForm())
      setRoomDraft(createDefaultRoomDraft())
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
      })
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể tải dữ liệu sơ đồ tài sản.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [clearSelectedRooms])

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
      if (roomContextMenu && contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setRoomContextMenu(null)
      }
      if (canvasContextMenu && contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setCanvasContextMenu(null)
      }

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
  }, [canvasContextMenu, hasUnsavedChanges, roomContextMenu])

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
    const requiredSize = getRequiredCanvasSize(floor.roomShapes)

    if (nextGridRows < requiredSize.gridRows || nextGridCols < requiredSize.gridCols) {
      toast.error(
        `Canvas quá nhỏ. Hiện cần ít nhất ${requiredSize.gridRows} hàng và ${requiredSize.gridCols} cột để chứa các phòng đang có.`,
      )
      return false
    }

    try {
      const response = await axiosClient.put(`/api/asset-map/floors/${floor.id}`, {
        name: floor.name,
        gridRows: nextGridRows,
        gridCols: nextGridCols,
        sortOrder: floor.sortOrder,
        canvasBackgroundColor: canvasBackgroundColor || floor.canvasBackgroundColor || '#FFFFFF',
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
        canvasBackgroundColor: canvasBackgroundColor || floor.canvasBackgroundColor || '#FFFFFF',
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

      setCanvasResizeState((previous) => ({ ...previous, handle: null }))

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
    if (!keepSelectedShape) {
      clearSelectedRooms()
    }
  }, [clearDragState, clearSelectedRooms])

  const beginAddRoomMode = useCallback((floorId) => {
    setActiveFloorId(floorId)
    setFloorInteractionMode('add')
    setDrawTool(DEFAULT_DRAW_TOOL)
    setSelectionEnabled(true)
    clearSelectedRooms()
    setSelectedCells(new Set())
    clearDragState()
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setRoomDraft(createDefaultRoomDraft())
  }, [clearDragState, clearSelectedRooms])

  const beginEditRoomMode = useCallback((shape, floorId) => {
    if (!shape) return
    setActiveFloorId(floorId)
    setSelectedRooms([shape.id], shape.id)
    setFloorInteractionMode('edit')
    setDrawTool(DEFAULT_DRAW_TOOL)
    setSelectionEnabled(true)
    setSelectedCells(new Set(shape.cells || []))
    clearDragState()
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setRoomDraft({
      mode: shape.locationId ? 'existing' : 'new',
      locationId: shape.locationId ? String(shape.locationId) : '',
      roomName: shape.roomName || '',
      colorHex: shape.colorHex || DEFAULT_COLOR,
      hasAsset: shape.hasAsset !== false,
    })
  }, [clearDragState, setSelectedRooms])

  const beginMoveRoomMode = useCallback((shape, floorId) => {
    if (!shape) return
    const targetIds = selectedShapeIdSet.has(Number(shape.id)) && selectedShapeIds.length > 0
      ? selectedShapeIds
      : [shape.id]
    setActiveFloorId(floorId)
    setSelectedRooms(targetIds, shape.id)
    setFloorInteractionMode('move')
    setDrawTool('move')
    setSelectionEnabled(false)
    setSelectedCells(new Set())
    clearDragState()
    setRoomDragState({ active: false, floorId: null, shapeIds: [], startX: 0, startY: 0, sourceShapes: [] })
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
  }, [clearDragState, selectedShapeIdSet, selectedShapeIds, setSelectedRooms])

  const openRoomInfoModal = useCallback((shape, floorId) => {
    if (!shape) return
    setActiveFloorId(floorId)
    setSelectedRooms([shape.id], shape.id)
    setDrawTool(DEFAULT_DRAW_TOOL)
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setRoomDraft({
      mode: shape.locationId ? 'existing' : 'new',
      locationId: shape.locationId ? String(shape.locationId) : '',
      roomName: shape.roomName || '',
      colorHex: shape.colorHex || DEFAULT_COLOR,
      hasAsset: shape.hasAsset !== false,
    })
    setShowRoomModal(true)
  }, [setSelectedRooms])

  const openRoomDraftModal = useCallback((shape = null) => {
    if (floorInteractionMode === 'add') {
      if (selectedCells.size === 0) {
        toast.error('Hãy chọn ít nhất một ô vuông để tạo phòng.')
        return
      }
      setRoomDraft((previous) => ({
        ...createDefaultRoomDraft(),
        colorHex: previous.colorHex || DEFAULT_COLOR,
      }))
    }

    if (floorInteractionMode === 'edit') {
      if (!shape && !selectedShape) {
        toast.error('Hãy chọn phòng cần sửa.')
        return
      }
      if (selectedCells.size === 0) {
        toast.error('Hãy chọn lại phạm vi của phòng trước khi lưu.')
        return
      }
      const targetShape = shape || selectedShape
      setRoomDraft({
        mode: targetShape.locationId ? 'existing' : 'new',
        locationId: targetShape.locationId ? String(targetShape.locationId) : '',
        roomName: targetShape.roomName || '',
        colorHex: targetShape.colorHex || DEFAULT_COLOR,
        hasAsset: targetShape.hasAsset !== false,
      })
    }

    setShowRoomModal(true)
  }, [floorInteractionMode, selectedCells.size, selectedShape])

  const handleCellPointerDown = (event, floor, cellKey, shape) => {
    if (Number(floor.id) !== Number(activeFloorId)) {
      setActiveFloorId(floor.id)
      exitInteractionMode(false)
      return
    }

    if (!showGridLines) {
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
    const baseSelection = event.shiftKey || event.metaKey || event.ctrlKey
      ? new Set(selectedCells)
      : new Set()

    setDragSelection({
      active: true,
      floorId: floor.id,
      startCell: cellKey,
      baseSelection,
    })
    setIsDraggingSelection(true)
    const nextSelection = new Set(baseSelection)
    nextSelection.add(cellKey)
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

    const shouldAutoOpenRoomModal = dragSelection.active
      && floorInteractionMode === 'add'
      && selectionEnabled
      && selectedCells.size > 0
      && !showRoomModal
    setDragSelection((previous) => ({ ...previous, active: false }))
    setIsDraggingSelection(false)
    if (shouldAutoOpenRoomModal) {
      openRoomDraftModal()
    }
  }

  const openCreateFloorModal = () => {
    setEditingFloorId(null)
    setFloorForm(createDefaultFloorForm())
    setShowFloorModal(true)
  }

  const openEditFloorModal = (floor) => {
    setEditingFloorId(floor.id)
    setFloorForm({
      name: floor.name || '',
      gridRows: floor.gridRows || 12,
      gridCols: floor.gridCols || 20,
    })
    setShowFloorModal(true)
  }

  const openCanvasSettingsModal = useCallback((floor, mode) => {
    if (!floor) return
    setActiveFloorId(floor.id)
    setCanvasContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setCanvasModalMode(mode)
    setCanvasForm({
      gridRows: floor.gridRows || 12,
      gridCols: floor.gridCols || 20,
      canvasBackgroundColor: floor.canvasBackgroundColor || '#FFFFFF',
    })
    setShowCanvasModal(true)
  }, [])

  const beginCanvasResizeMode = useCallback((floor) => {
    if (!floor) return
    const requiredSize = getRequiredCanvasSize(floor.roomShapes)
    setActiveFloorId(floor.id)
    setDrawTool(DEFAULT_DRAW_TOOL)
    setCanvasContextMenu(null)
    setShowCanvasModal(false)
    setCanvasResizeState({
      enabled: true,
      floorId: floor.id,
      handle: null,
      startX: 0,
      startY: 0,
      startRows: floor.gridRows || 12,
      startCols: floor.gridCols || 20,
      requiredRows: requiredSize.gridRows,
      requiredCols: requiredSize.gridCols,
    })
    toast.info('Kéo viền phải, viền dưới hoặc góc phải dưới của canvas để đổi kích thước.')
  }, [])

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
        applyFloorResponse(response.data, {
          preserveRoomShapes: true,
          selectFloor: true,
          keepSelection: true,
        })
        toast.success('Cập nhật tầng thành công.')
      } else {
        const response = await axiosClient.post('/api/asset-map/floors', payload)
        setShowFloorModal(false)
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
    if (!canvasResizeState.enabled || Number(canvasResizeState.floorId) !== Number(floor.id)) return
    event.preventDefault()
    event.stopPropagation()
    const requiredSize = getRequiredCanvasSize(floor.roomShapes)
    setCanvasResizeState((previous) => ({
      ...previous,
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

  const handleCanvasContextMenu = (event, floor) => {
    if (floorInteractionMode !== 'view') return
    event.preventDefault()
    setActiveFloorId(floor.id)
    clearSelectedRooms()
    setRoomContextMenu(null)
    setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))
    setCanvasContextMenu({
      floorId: floor.id,
      x: event.clientX,
      y: event.clientY,
    })
  }

  const handleSaveCanvasSettings = async () => {
    const floorId = canvasContextMenu?.floorId || activeFloorId
    return persistCanvasSettings({
      floorId,
      gridRows: canvasForm.gridRows,
      gridCols: canvasForm.gridCols,
      canvasBackgroundColor: canvasForm.canvasBackgroundColor,
      successMessage: 'Đã cập nhật canvas của tầng.',
      closeModal: true,
    })
  }

  const handleRoomClick = (event, floor, shape) => {
    event.preventDefault()
    setActiveFloorId(floor.id)
    setRoomContextMenu(null)
    setCanvasContextMenu(null)

    if (floorInteractionMode === 'view' && drawTool === 'paint') {
      setSelectedRooms([shape.id], shape.id)
      void handlePaintColorChange(currentPaintColor, shape)
      return
    }

    const isToggleSelection = floorInteractionMode === 'view'
      && (event.metaKey || event.ctrlKey || event.shiftKey)

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

  const handleRoomContextMenu = (event, floor, shape) => {
    event.preventDefault()
    setActiveFloorId(floor.id)
    if (selectedShapeIdSet.has(Number(shape.id))) {
      setSelectedRooms(selectedShapeIds, shape.id)
    } else {
      setSelectedRooms([shape.id], shape.id)
    }
    setCanvasContextMenu(null)
    setRoomContextMenu({
      floorId: floor.id,
      shapeId: shape.id,
      x: event.clientX,
      y: event.clientY,
    })
  }

  const handleOpenRoomAssets = async (shape, floorId) => {
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
    if (floorInteractionMode === 'add') {
      if (selectedCells.size === 0) return
      handleClearSelection()
      return
    }

    if (floorInteractionMode === 'edit') {
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
    const draftShapeId = editingShape ? editingShape.id : nextTempShapeId

    if (isShapeRedrawMode && selectedCells.size === 0) {
      toast.error('Hãy chọn vùng ô vuông trước khi tạo phòng.')
      return false
    }
    if (roomDraft.mode === 'existing' && !roomDraft.locationId) {
      toast.error('Vui lòng chọn phòng có sẵn.')
      return false
    }
    if (roomDraft.mode === 'new' && !roomDraft.roomName.trim()) {
      toast.error('Vui lòng nhập tên phòng.')
      return false
    }

    const location = roomDraft.mode === 'existing'
      ? locations.find((item) => Number(item.id) === Number(roomDraft.locationId))
      : null

    const nextShape = {
      id: draftShapeId,
      locationId: roomDraft.mode === 'existing' ? Number(roomDraft.locationId) : null,
      roomName: roomDraft.mode === 'existing' ? (location?.roomName || editingShape?.roomName || '') : roomDraft.roomName.trim(),
      cells: isShapeRedrawMode
        ? Array.from(selectedCells).sort(compareCells)
        : [...(editingShape?.cells || [])].sort(compareCells),
      colorHex: roomDraft.colorHex || DEFAULT_COLOR,
      hasAsset: roomDraft.hasAsset !== false,
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
    setSelectedCells(new Set())
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
    setRoomDraft(createDefaultRoomDraft())
    setFloorForm(createDefaultFloorForm())
    setCanvasForm(createDefaultCanvasForm())
    setEditingFloorId(null)
    setFloorInteractionMode('view')
    setDrawTool(DEFAULT_DRAW_TOOL)
    setSelectionEnabled(false)
    setSelectionMoveState({ active: false, floorId: null, startCell: null, sourceCells: [] })
    setRoomDragState({ active: false, floorId: null, shapeIds: [], startX: 0, startY: 0, sourceShapes: [] })
    setRoomContextMenu(null)
    setCanvasContextMenu(null)
  }, [clearDragState, clearSelectedRooms])

  const handleClearSelection = useCallback(() => {
    setSelectedCells(new Set())
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
      if (showRoomModal) {
        const savedRoomDraft = await handleSaveRoomDraft()
        if (!savedRoomDraft) return
      }

      if (showFloorModal) {
        const savedFloor = await handleSaveFloor()
        if (!savedFloor) return
      }

      if (showCanvasModal) {
        const savedCanvas = await handleSaveCanvasSettings()
        if (!savedCanvas) return
      }

      if (selectedCells.size > 0) {
        toast.error('Vùng chọn hiện chưa được gán thành phòng nên chưa thể lưu. Hãy tạo phòng hoặc chọn Không lưu.')
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
      }
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
      }
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
    if (!markerTooltip) return undefined

    const hideTooltip = () => {
      setMarkerTooltip(null)
    }

    window.addEventListener('scroll', hideTooltip, true)
    window.addEventListener('resize', hideTooltip)
    return () => {
      window.removeEventListener('scroll', hideTooltip, true)
      window.removeEventListener('resize', hideTooltip)
    }
  }, [markerTooltip])

  const handleMarkerTooltipShow = useCallback((event, asset) => {
    const nextPosition = calculateMarkerTooltipPosition(event.currentTarget.getBoundingClientRect())
    setMarkerTooltip({
      asset,
      ...nextPosition,
    })
  }, [])

  const handleMarkerTooltipHide = useCallback((asset) => {
    setMarkerTooltip((previous) => (previous?.asset?.qaCode === asset.qaCode ? null : previous))
  }, [])

  const renderDrawToolButton = ({
    icon,
    label,
    description = '',
    active = false,
    onClick,
    disabled = false,
    danger = false,
  }) => (
    <div className="group relative">
      <button
        type="button"
        title={description ? `${label}: ${description}` : label}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
          danger
            ? 'border-red-200 text-red-600 hover:bg-red-50'
            : active
              ? 'border-fptOrange bg-orange-50 text-fptOrange shadow-sm'
              : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {icon}
      </button>
      {description && (
        <div className="pointer-events-none absolute left-1/2 top-12 z-20 hidden w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus-within:block dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      )}
    </div>
  )

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
              onClick={openCreateFloorModal}
              className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
            >
              <Plus size={16} />
              Thêm tầng
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {floors.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Chưa có tầng nào</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Hãy thêm tầng đầu tiên để bắt đầu vẽ sơ đồ toà nhà.</p>
            </div>
          )}

          {/* eslint-disable-next-line react-hooks/refs */}
          {floors.map((floor) => {
            const isActive = Number(floor.id) === Number(activeFloorId)
            const cellShapeMap = cellShapeMaps[floor.id] || new Map()
            const hasDirtyChanges = dirtyFloorIds.has(floor.id)
            const isFloorEditing = isActive && floorInteractionMode === 'edit'
            return (
              <div
                key={floor.id}
                id={`asset-map-floor-${floor.id}`}
                onClick={() => {
                  setActiveFloorId(floor.id)
                  setRoomContextMenu(null)
                }}
                className={`rounded-2xl bg-white p-4 shadow-sm transition dark:bg-slate-900 ${
                  isActive ? 'ring-2 ring-fptOrange/30' : ''
                }`}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{floor.name}</h3>
                      {hasDirtyChanges && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Chưa lưu
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Grid {floor.gridRows} x {floor.gridCols} · {(floor.roomShapes || []).length} phòng đã vẽ
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isActive && floorInteractionMode === 'view' && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            beginAddRoomMode(floor.id)
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
                        >
                          <Plus size={16} />
                          Thêm phòng
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditFloorModal(floor)
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Edit size={16} />
                          Sửa tầng
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteFloor(floor)
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          <Trash size={16} />
                          Xóa tầng
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isActive && ((floorInteractionMode === 'add' || floorInteractionMode === 'edit') || (floorInteractionMode === 'view' && selectedShapes.length > 0)) && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex flex-wrap items-center gap-2">
                      {floorInteractionMode !== 'view' && renderDrawToolButton({
                        icon: <MouseToolIcon size={16} />,
                        label: 'Kéo chọn vùng',
                        description: floorInteractionMode === 'add'
                          ? 'Kéo chuột trên lưới để chọn vùng tạo phòng. Sau khi thả chuột, modal thông tin phòng sẽ tự mở.'
                          : 'Kéo chuột để chọn lại phạm vi của phòng đang chỉnh sửa.',
                        active: drawTool === 'select',
                        onClick: () => setActiveDrawTool('select'),
                      })}
                      {floorInteractionMode !== 'add' && renderDrawToolButton({
                        icon: <HandToolIcon size={16} />,
                        label: floorInteractionMode === 'view' ? 'Kéo di chuyển phòng/cụm phòng' : 'Di chuyển vùng',
                        active: drawTool === 'move',
                        onClick: () => setActiveDrawTool('move'),
                        disabled: floorInteractionMode === 'view' && selectedShapes.length === 0,
                      })}
                      {renderDrawToolButton({
                        icon: <X size={16} />,
                        label: 'Bỏ chọn',
                        description: floorInteractionMode === 'view'
                          ? 'Bỏ chọn toàn bộ phòng đang được chọn trên sơ đồ.'
                          : 'Xóa vùng đang chọn để bạn chọn lại từ đầu.',
                        onClick: () => {
                          if (floorInteractionMode === 'view') {
                            clearSelectedRooms()
                            return
                          }
                          handleClearSelection()
                        },
                        disabled: floorInteractionMode === 'view' ? selectedShapes.length === 0 : selectedCells.size === 0,
                      })}
                      {renderDrawToolButton({
                        icon: <Trash size={16} />,
                        label: floorInteractionMode === 'view' ? 'Xóa vùng phòng' : 'Xóa vùng',
                        description: floorInteractionMode === 'view'
                          ? 'Gỡ vùng phòng khỏi sơ đồ nhưng không xóa phòng nghiệp vụ trong hệ thống.'
                          : 'Xóa nhanh vùng đang chọn khỏi lưới hiện tại.',
                        onClick: () => { void handleDeleteActiveRegion() },
                        disabled: floorInteractionMode === 'view' ? selectedShapes.length !== 1 : selectedCells.size === 0,
                        danger: true,
                      })}
                      {floorInteractionMode !== 'add' && renderDrawToolButton({
                        icon: <PaintToolIcon size={16} />,
                        label: 'Tô màu',
                        active: drawTool === 'paint',
                        onClick: () => setActiveDrawTool('paint'),
                        disabled: floorInteractionMode === 'view' ? selectedShapes.length !== 1 : false,
                      })}
                      {floorInteractionMode !== 'add' && (
                        <label
                          title="Chọn màu tô"
                          className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <input
                            type="color"
                            value={currentPaintColor}
                            onChange={(event) => { void handlePaintColorChange(event.target.value) }}
                            className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                          />
                          <span>{currentPaintColor.toUpperCase()}</span>
                        </label>
                      )}
                      {floorInteractionMode === 'add' && (
                        <button
                          type="button"
                          onClick={() => exitInteractionMode(false)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <X size={16} />
                          Hủy
                        </button>
                      )}
                    </div>
                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      {floorInteractionMode === 'view'
                        ? selectedShapes.length > 1
                          ? `Đang chọn ${selectedShapes.length} phòng. Giữ Ctrl/Cmd/Shift rồi nhấp vào phòng để chọn thêm hoặc bỏ bớt phòng, sau đó dùng bàn tay để kéo cả cụm.`
                          : `Đang chọn phòng ${selectedShape?.roomName || ''}. Giữ Ctrl/Cmd/Shift rồi nhấp vào phòng khác để chọn nhiều phòng cùng lúc và di chuyển cả cụm.`
                        : floorInteractionMode === 'edit'
                          ? `Công cụ hiện tại: ${drawTool === 'move' ? 'Di chuyển vùng' : drawTool === 'paint' ? 'Tô màu phòng' : 'Kéo chọn lại phạm vi phòng'}.`
                          : `Công cụ hiện tại: Kéo chọn vùng tạo phòng. Màu phòng được chọn trong modal khi lưu phòng.${selectedCells.size > 0 ? ` Đã chọn ${selectedCells.size} ô trống${isDraggingSelection ? ' và đang kéo chuột để quét vùng.' : '.'}` : ''}`}
                    </div>
                  </div>
                )}

                {isActive && floorInteractionMode === 'edit' && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <span className="rounded-lg bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-700">
                      Đang sửa phòng {selectedShape?.roomName || ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => openRoomDraftModal(selectedShape)}
                      disabled={selectedCells.size === 0 || savingLayout}
                      className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save size={16} />
                      Lưu phòng
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={selectedCells.size === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <X size={16} />
                      Bỏ chọn vùng
                    </button>
                    <button
                      type="button"
                      onClick={() => exitInteractionMode()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <X size={16} />
                      Hủy sửa
                    </button>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {drawTool === 'select'
                        ? `Kéo chuột để chọn lại phạm vi phòng. Vùng hiện tại có ${selectedCells.size} ô.`
                        : drawTool === 'move'
                          ? 'Dùng biểu tượng bàn tay rồi kéo trên vùng đã chọn để di chuyển phòng.'
                          : 'Dùng thùng sơn để đổi màu phòng đang chỉnh sửa.'}
                    </span>
                  </div>
                )}

                {isActive && floorInteractionMode === 'move' && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-700">
                      <Move size={16} />
                      {selectedShapes.length > 1
                        ? `Đang di chuyển cụm ${selectedShapes.length} phòng`
                        : `Đang di chuyển phòng ${selectedShape?.roomName || ''}`}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Dùng các phím mũi tên để tịnh tiến từng ô hoặc kéo trực tiếp trên một phòng đang chọn. Bấm Enter để kết thúc.
                    </span>
                  </div>
                )}

                {isActive && canvasResizeState.enabled && floorInteractionMode === 'view' && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/20">
                    <span className="rounded-lg bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-700">
                      Đang đổi kích thước canvas
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Kéo ở viền phải, viền dưới hoặc góc phải dưới. Canvas sẽ tự lưu khi bạn thả chuột.
                    </span>
                    <button
                      type="button"
                      onClick={() => setCanvasResizeState((previous) => ({ ...previous, enabled: false, handle: null, floorId: null }))}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <X size={16} />
                      Kết thúc
                    </button>
                  </div>
                )}

                <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div
                    className="relative"
                    style={{
                      width: floor.gridCols * CELL_SIZE,
                      height: floor.gridRows * CELL_SIZE,
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-xl border border-slate-300 dark:border-slate-700"
                      style={{
                        backgroundColor: floor.canvasBackgroundColor || '#FFFFFF',
                      }}
                      onContextMenu={(event) => handleCanvasContextMenu(event, floor)}
                    />

                    {isActive && canvasResizeState.enabled && floorInteractionMode === 'view' && (
                      <>
                        <button
                          type="button"
                          aria-label="Kéo thay đổi chiều rộng canvas"
                          onMouseDown={(event) => handleCanvasResizeStart(event, floor, 'right')}
                          className="absolute right-[-7px] top-4 bottom-4 z-20 w-4 cursor-ew-resize rounded-full bg-sky-500/70 shadow hover:bg-sky-500"
                        />
                        <button
                          type="button"
                          aria-label="Kéo thay đổi chiều cao canvas"
                          onMouseDown={(event) => handleCanvasResizeStart(event, floor, 'bottom')}
                          className="absolute bottom-[-7px] left-4 right-4 z-20 h-4 cursor-ns-resize rounded-full bg-sky-500/70 shadow hover:bg-sky-500"
                        />
                        <button
                          type="button"
                          aria-label="Kéo thay đổi kích thước canvas"
                          onMouseDown={(event) => handleCanvasResizeStart(event, floor, 'corner')}
                          className="absolute bottom-[-9px] right-[-9px] z-30 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-sky-600 shadow-lg hover:bg-sky-500"
                        />
                      </>
                    )}

                    {showGridLines && isActive && (
                      <div
                        className="absolute inset-0 grid"
                        style={{
                          gridTemplateColumns: `repeat(${floor.gridCols}, ${CELL_SIZE}px)`,
                          gridTemplateRows: `repeat(${floor.gridRows}, ${CELL_SIZE}px)`,
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
                                onMouseDown={(event) => handleCellPointerDown(event, floor, cellKey, shape)}
                                onMouseEnter={() => handleCellPointerEnter(floor, cellKey, shape)}
                                onMouseUp={handleCellPointerUp}
                                onDragStart={(event) => event.preventDefault()}
                                className={`relative border border-slate-300 transition dark:border-slate-700 ${
                                  drawTool === 'select' && !shape ? 'hover:bg-orange-50 dark:hover:bg-orange-500/10' : ''
                                } ${isSelected ? 'ring-2 ring-inset ring-fptOrange' : ''}`}
                                style={{
                                  width: CELL_SIZE,
                                  height: CELL_SIZE,
                                  backgroundColor: isSelected
                                    ? colorWithAlpha(
                                      isEditableShapeCell
                                        ? (roomDraft.colorHex || rawShape?.colorHex || DEFAULT_COLOR)
                                        : (roomDraft.colorHex || DEFAULT_COLOR),
                                      0.28,
                                    )
                                    : shape
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

                    {(floor.roomShapes || []).map((shape) => {
                      if (isFloorEditing && Number(shape.id) === Number(selectedShapeId)) {
                        return null
                      }

                      const bounds = getShapeBounds(shape)
                      const isSelected = selectedShapeIdSet.has(Number(shape.id))
                      const roomBackgroundColor = isSelected
                        ? colorWithAlpha(shape.colorHex, 0.28)
                        : (shape.colorHex || DEFAULT_COLOR)
                      const roomTextColor = isSelected ? '#0f172a' : getReadableTextColor(shape.colorHex)

                      return (
                        <button
                          key={`room-${shape.id}`}
                          type="button"
                          onMouseDown={(event) => handleRoomPointerDown(event, floor, shape)}
                          onClick={(event) => handleRoomClick(event, floor, shape)}
                          onContextMenu={(event) => handleRoomContextMenu(event, floor, shape)}
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

                    {(floor.roomShapes || []).flatMap((shape) => {
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
                              onMouseEnter={(event) => handleMarkerTooltipShow(event, asset)}
                              onMouseLeave={() => handleMarkerTooltipHide(asset)}
                              onFocus={(event) => handleMarkerTooltipShow(event, asset)}
                              onBlur={() => handleMarkerTooltipHide(asset)}
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
                    })}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ghi chú sử dụng</p>
                      <button
                        type="button"
                        onClick={() => setNotesCollapsed((previous) => !previous)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {notesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        {notesCollapsed ? 'Mở' : 'Thu gọn'}
                      </button>
                    </div>
                    {notesCollapsed ? (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Đã thu gọn phần hướng dẫn sử dụng. Nhấp `Mở` để xem cách thao tác trên sơ đồ.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                          <p className="font-semibold text-slate-700 dark:text-slate-100">1. Xem sơ đồ</p>
                          <p className="mt-1">
                            Ở trạng thái bình thường, sơ đồ chỉ hiện các khu vực đã vẽ. Nhấp chuột trái vào một khu vực để chọn,
                            nhấp chuột phải để mở menu thao tác nhanh.
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                          <p className="font-semibold text-slate-700 dark:text-slate-100">2. Thêm hoặc vẽ lại khu vực</p>
                          <p className="mt-1">
                            Khi vào chế độ thêm phòng hoặc vẽ lại phòng, lưới ô vuông sẽ hiện ra. Hãy dùng công cụ con trỏ để kéo chọn
                            vùng, sau đó nhập thông tin khu vực trong modal và lưu lại.
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                          <p className="font-semibold text-slate-700 dark:text-slate-100">3. Tìm tài sản trên sơ đồ</p>
                          <p className="mt-1">
                            Dùng ô tìm kiếm hoặc bộ lọc bên phải để tìm tài sản theo QA code, tên, loại hoặc phòng. Kết quả phù hợp sẽ
                            hiện marker đỏ trên đúng khu vực đã được vẽ.
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                          <p className="font-semibold text-slate-700 dark:text-slate-100">4. Chỉnh sửa nhanh</p>
                          <p className="mt-1">
                            Từ menu chuột phải của khu vực, bạn có thể vẽ lại phạm vi, sửa thông tin, xem danh sách tài sản hoặc di
                            chuyển khu vực sang vị trí khác trên tầng. Giữ Ctrl/Cmd/Shift rồi nhấp thêm các phòng khác nếu muốn
                            chọn nhiều phòng và di chuyển nguyên cả cụm.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Phòng trên tầng</p>
                      <button
                        type="button"
                        onClick={() => setRoomsCollapsed((previous) => !previous)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {roomsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        {roomsCollapsed ? 'Mở' : 'Thu gọn'}
                      </button>
                    </div>
                    {roomsCollapsed ? (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {(floor.roomShapes || []).length > 0
                          ? `${(floor.roomShapes || []).length} khu vực trên tầng này.`
                          : 'Chưa có phòng nào trên tầng này.'}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(floor.roomShapes || []).length === 0 && (
                          <span className="text-sm text-slate-400">Chưa có phòng nào trên tầng này.</span>
                        )}
                        {(floor.roomShapes || []).map((shape) => (
                          <button
                            key={`chip-${shape.id}`}
                            type="button"
                            onClick={(event) => {
                              setActiveFloorId(floor.id)
                              if (event.metaKey || event.ctrlKey || event.shiftKey) {
                                const normalizedShapeId = Number(shape.id)
                                const nextIds = selectedShapeIdSet.has(normalizedShapeId)
                                  ? selectedShapeIds.filter((value) => Number(value) !== normalizedShapeId)
                                  : [...selectedShapeIds, normalizedShapeId]
                                setSelectedRooms(nextIds, nextIds.length > 0 ? normalizedShapeId : null)
                              } else {
                                setSelectedRooms([shape.id], shape.id)
                              }
                              setRoomContextMenu(null)
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              selectedShapeIdSet.has(Number(shape.id))
                                ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200'
                                : 'text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {buildShapeOptionLabel(shape, locations)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <aside className="space-y-4">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tìm tài sản</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Quét QR, nhập QA code, tên tài sản hoặc lọc theo loại và phòng.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Camera size={16} />
                  Quét QR
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Từ khóa</label>
                  <input
                    value={searchFilters.keyword}
                    onChange={(event) => setSearchFilters((previous) => ({ ...previous, keyword: event.target.value }))}
                    placeholder="Nhập QA code hoặc tên tài sản"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Loại tài sản</label>
                  <select
                    value={searchFilters.categoryId}
                    onChange={(event) => setSearchFilters((previous) => ({ ...previous, categoryId: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Tất cả loại</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tầng</label>
                  <select
                    value={searchFilters.floorId}
                    onChange={(event) => setSearchFilters((previous) => ({ ...previous, floorId: event.target.value, locationId: '' }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Tất cả tầng</option>
                    {floors.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phòng</label>
                  <select
                    value={searchFilters.locationId}
                    onChange={(event) => setSearchFilters((previous) => ({ ...previous, locationId: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Tất cả phòng</option>
                    {filteredLocationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.roomName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={searching}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  <Search size={16} />
                  Tìm kiếm
                </button>
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Xóa
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kết quả</h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">{searchResults.length} tài sản</span>
              </div>
              <div className="mt-4 space-y-3">
                {searchResults.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Chưa có kết quả. Hãy dùng bộ lọc hoặc quét QR để hiển thị marker trên sơ đồ.
                  </div>
                )}
                {searchResults.map((asset) => {
                  const floor = floors.find((item) => Number(item.id) === Number(asset.floorId))
                  const isMapped = floor?.roomShapes?.some((shape) => Number(shape.locationId) === Number(asset.locationId))
                  return (
                    <button
                      key={asset.qaCode}
                      type="button"
                      onClick={() => {
                        if (asset.floorId) {
                          setActiveFloorId(asset.floorId)
                          scrollToFloor(asset.floorId)
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{asset.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">QA: {asset.qaCode}</p>
                        </div>
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Marker
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <p>Phòng hiện tại: {asset.locationName || 'Chưa rõ'}</p>
                        <p>Tầng: {asset.floorName || 'Chưa gán tầng'}</p>
                        <p>Loại: {asset.categoryName || 'Chưa rõ'}</p>
                        {!isMapped && <p className="font-semibold text-amber-600">Phòng này chưa được vẽ trên sơ đồ.</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

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

      {roomContextMenu && selectedShape && (
        <div
          ref={contextMenuRef}
          className="fixed z-[55] min-w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          style={{
            top: Math.min(roomContextMenu.y, window.innerHeight - 220),
            left: Math.min(roomContextMenu.x, window.innerWidth - 240),
          }}
        >
          <button
            type="button"
            onClick={() => beginEditRoomMode(selectedShape, activeFloorId)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit size={16} />
            Vẽ lại phòng
          </button>
          <button
            type="button"
            onClick={() => openRoomInfoModal(selectedShape, activeFloorId)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit size={16} />
            Sửa thông tin phòng
          </button>
          <button
            type="button"
            onClick={() => handleRemoveShape(selectedShape)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash size={16} />
            Xóa phòng
          </button>
          <button
            type="button"
            onClick={() => handleOpenRoomAssets(selectedShape, activeFloorId)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ListDetails size={16} />
            Xem danh sách tài sản
          </button>
          <button
            type="button"
            onClick={() => beginMoveRoomMode(selectedShape, activeFloorId)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Move size={16} />
            Di chuyển phòng
          </button>
        </div>
      )}

      {canvasContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[55] min-w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          style={{
            top: Math.min(canvasContextMenu.y, window.innerHeight - 180),
            left: Math.min(canvasContextMenu.x, window.innerWidth - 260),
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!activeFloor) return
              beginAddRoomMode(activeFloor.id)
              setCanvasContextMenu(null)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus size={16} />
            Thêm phòng
          </button>
          <button
            type="button"
            onClick={() => openCanvasSettingsModal(activeFloor, 'color')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Edit size={16} />
            Đổi màu nền canvas
          </button>
          <button
            type="button"
            onClick={() => beginCanvasResizeMode(activeFloor)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Move size={16} />
            Thay đổi kích thước canvas
          </button>
        </div>
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
                onClick={() => setShowFloorModal(false)}
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
            </div>
            <div className="mt-4 flex gap-2">
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
                onClick={() => setShowCanvasModal(false)}
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
                onClick={() => setShowCanvasModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCanvasSettings}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
              >
                Lưu canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {!selectedShape
                  ? 'Tạo phòng từ vùng chọn'
                  : floorInteractionMode === 'edit'
                    ? 'Cập nhật phòng sau khi vẽ lại'
                    : 'Sửa thông tin phòng'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRoomModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Kiểu gán phòng</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomDraft((previous) => ({ ...previous, mode: 'new', locationId: '' }))}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      roomDraft.mode === 'new'
                        ? 'bg-orange-100 text-orange-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Tạo phòng mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomDraft((previous) => ({ ...previous, mode: 'existing' }))}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      roomDraft.mode === 'existing'
                        ? 'bg-orange-100 text-orange-700'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Gắn phòng có sẵn
                  </button>
                </div>
              </div>

              {roomDraft.mode === 'existing' ? (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phòng có sẵn</label>
                  <select
                    value={roomDraft.locationId}
                    onChange={(event) => {
                      const nextLocationId = event.target.value
                      const selectedLocation = locations.find((item) => String(item.id) === String(nextLocationId))
                      setRoomDraft((previous) => ({
                        ...previous,
                        locationId: nextLocationId,
                        hasAsset: selectedLocation?.hasAsset !== false,
                      }))
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Chọn phòng</option>
                    {locationOptionsForRoomModal.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.roomName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên phòng mới</label>
                  <input
                    value={roomDraft.roomName}
                    onChange={(event) => setRoomDraft((previous) => ({ ...previous, roomName: event.target.value }))}
                    placeholder="Ví dụ: P.201 hoặc Kho thiết bị"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Màu phòng</label>
                <input
                  type="color"
                  value={roomDraft.colorHex}
                  onChange={(event) => setRoomDraft((previous) => ({ ...previous, colorHex: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-start gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={roomDraft.hasAsset !== false}
                      onChange={(event) => setRoomDraft((previous) => ({ ...previous, hasAsset: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                    />
                    Khu vực chứa tài sản
                  </label>
                  <div className="group relative mt-0.5">
                    <button
                      type="button"
                      className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="Giải thích khu vực chứa tài sản"
                    >
                      <InfoCircle size={16} />
                    </button>
                    <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
                      Bật tùy chọn này nếu khu vực được phép làm vị trí đặt hoặc lưu trữ tài sản. Nếu bỏ chọn, khu vực chỉ đóng vai trò minh hoạ trên sơ đồ như hành lang, sân hoặc cổng.
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                {selectedShape ? (
                  floorInteractionMode === 'edit'
                    ? <p>Phạm vi phòng hiện có {selectedCells.size} ô. Bạn có thể kéo chọn lại vùng trước khi lưu tên hoặc màu phòng.</p>
                    : <p>Bạn đang sửa thông tin của phòng hiện có. Phạm vi phòng trên sơ đồ sẽ được giữ nguyên.</p>
                ) : (
                  <p>Vùng chọn hiện có {selectedCells.size} ô vuông. Khi bấm lưu, hệ thống sẽ ghi thẳng thay đổi xuống backend mà không tải lại toàn trang.</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSaveRoomDraft}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
              >
                Lưu phòng trên sơ đồ
              </button>
            </div>
          </div>
        </div>
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
