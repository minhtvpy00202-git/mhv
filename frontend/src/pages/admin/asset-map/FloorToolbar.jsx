import {
  IconArrowsMove as Move,
  IconEdit as Edit,
  IconDeviceFloppy as Save,
  IconPlus as Plus,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react'

export default function FloorToolbar({
  floor,
  isImageFloor,
  isActive,
  hasDirtyChanges,
  surfaceMode,
  floorInteractionMode,
  drawTool,
  selectedShape,
  selectedShapes,
  selectedCellsSize,
  isDraggingSelection,
  hasImageSelection,
  imageSelectionPointCount,
  savingLayout,
  currentPaintColor,
  canvasResizeEnabled,
  renderDrawToolButton,
  MouseToolIcon,
  HandToolIcon,
  PaintToolIcon,
  imageRectangleTool,
  imagePolygonTool,
  legendItems,
  activeLegendFilters,
  visibleRoomCount,
  onAddRoom,
  onEditFloor,
  onDeleteFloor,
  onToggleLegendFilter,
  onResetLegendFilters,
  onSetDrawTool,
  onClearSelection,
  onDeleteActiveRegion,
  onFinishImagePolygon,
  onOpenRoomDraft,
  onExitInteractionMode,
  onPaintColorChange,
  onEndCanvasResize,
}) {
  if (!isActive) return null

  const showImageTools = isImageFloor
    && (floorInteractionMode === 'add' || floorInteractionMode === 'edit')

  const showGridTools = !isImageFloor
    && (floorInteractionMode === 'add' || floorInteractionMode === 'edit')

  const modeBadgeClass = surfaceMode.key === 'assign'
    ? 'bg-orange-100 text-orange-700'
    : surfaceMode.key === 'layout'
      ? 'bg-sky-100 text-sky-700'
      : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'

  return (
    <>
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
            {isImageFloor
              ? `Ảnh nền ${floor.imageWidth || '?'} x ${floor.imageHeight || '?'} · ${(floor.roomShapes || []).length} phòng đã vẽ`
              : `Grid ${floor.gridRows} x ${floor.gridCols} · ${(floor.roomShapes || []).length} phòng đã vẽ`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${modeBadgeClass}`}>
              {surfaceMode.label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {surfaceMode.description}
            </span>
          </div>
        </div>
        {floorInteractionMode === 'view' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAddRoom}
              className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
            >
              <Plus size={16} />
              Thêm phòng
            </button>
            <button
              type="button"
              onClick={onEditFloor}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Edit size={16} />
              Sửa tầng
            </button>
            <button
              type="button"
              onClick={onDeleteFloor}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash size={16} />
              Xóa tầng
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Legend / Filter
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hiển thị {visibleRoomCount}/{(floor.roomShapes || []).length} khu vực theo bộ lọc.
            </p>
          </div>
          {activeLegendFilters.length > 0 && (
            <button
              type="button"
              onClick={onResetLegendFilters}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Xóa lọc
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {legendItems.map((item) => {
            const isActiveFilter = activeLegendFilters.includes(item.key)
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggleLegendFilter(item.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActiveFilter
                    ? `${item.tone} ring-2 ring-current/15`
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {showImageTools && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center gap-2">
            {floorInteractionMode !== 'view' && renderDrawToolButton({
              icon: <MouseToolIcon size={16} />,
              label: 'Vẽ rectangle',
              description: 'Kéo trực tiếp trên ảnh để tạo vùng hình chữ nhật cho phòng.',
              active: drawTool === imageRectangleTool,
              onClick: () => onSetDrawTool(imageRectangleTool),
            })}
            {floorInteractionMode !== 'view' && renderDrawToolButton({
              icon: <Edit size={16} />,
              label: 'Vẽ polygon',
              description: 'Nhấp từng điểm trên ảnh để tạo vùng tự do theo biên dạng thực tế của phòng.',
              active: drawTool === imagePolygonTool,
              onClick: () => onSetDrawTool(imagePolygonTool),
            })}
            {renderDrawToolButton({
              icon: <X size={16} />,
              label: 'Bỏ chọn',
              description: floorInteractionMode === 'view'
                ? 'Bỏ chọn phòng đang chọn.'
                : 'Xóa vùng đang vẽ trên ảnh để chọn lại từ đầu.',
              onClick: onClearSelection,
              disabled: floorInteractionMode === 'view' ? selectedShapes.length === 0 : !hasImageSelection && imageSelectionPointCount === 0,
            })}
            {renderDrawToolButton({
              icon: <Trash size={16} />,
              label: floorInteractionMode === 'view' ? 'Xóa vùng phòng' : 'Xóa vùng',
              description: floorInteractionMode === 'view'
                ? 'Gỡ vùng phòng khỏi sơ đồ nhưng không xóa phòng nghiệp vụ trong hệ thống.'
                : 'Xóa nhanh vùng đang vẽ trên ảnh.',
              onClick: onDeleteActiveRegion,
              disabled: floorInteractionMode === 'view' ? selectedShapes.length !== 1 : !hasImageSelection && imageSelectionPointCount === 0,
              danger: true,
            })}
            {drawTool === imagePolygonTool && floorInteractionMode !== 'view' && (
              <button
                type="button"
                onClick={onFinishImagePolygon}
                disabled={!hasImageSelection}
                className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />
                Hoàn tất vùng
              </button>
            )}
            {floorInteractionMode === 'edit' && (
              <button
                type="button"
                onClick={onOpenRoomDraft}
                disabled={(!hasImageSelection && !selectedShape) || savingLayout}
                className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />
                Lưu phòng
              </button>
            )}
            {floorInteractionMode !== 'view' && (
              <button
                type="button"
                onClick={onExitInteractionMode}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X size={16} />
                {floorInteractionMode === 'edit' ? 'Hủy sửa' : 'Hủy'}
              </button>
            )}
          </div>
          <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {floorInteractionMode === 'view'
              ? selectedShapes.length > 1
                ? `Đang chọn ${selectedShapes.length} phòng trên ảnh nền.`
                : `Đang chọn phòng ${selectedShape?.roomName || ''}.`
              : drawTool === imagePolygonTool
                ? `Nhấp từng điểm trên ảnh để tạo polygon.${imageSelectionPointCount > 0 ? ` Hiện có ${imageSelectionPointCount} điểm. Có thể kéo các chấm tròn để nắn lại biên; Enter để hoàn tất, Backspace/Delete để bỏ điểm cuối.` : ''}`
                : hasImageSelection
                  ? 'Đã chọn xong một vùng trên ảnh. Có thể kéo các chấm tròn ở góc để tinh chỉnh trước khi lưu phòng.'
                  : 'Kéo trực tiếp trên ảnh để khoanh vùng phòng bằng rectangle, hoặc chuyển sang polygon để vẽ tự do.'}
          </div>
        </div>
      )}

      {showGridTools && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center gap-2">
            {floorInteractionMode !== 'view' && renderDrawToolButton({
              icon: <MouseToolIcon size={16} />,
              label: 'Kéo chọn vùng',
              description: floorInteractionMode === 'add'
                ? 'Kéo chuột trên lưới để chọn vùng tạo phòng. Sau khi thả chuột, modal thông tin phòng sẽ tự mở.'
                : 'Kéo chuột để chọn lại phạm vi của phòng đang chỉnh sửa.',
              active: drawTool === 'select',
              onClick: () => onSetDrawTool('select'),
            })}
            {floorInteractionMode !== 'add' && renderDrawToolButton({
              icon: <HandToolIcon size={16} />,
              label: floorInteractionMode === 'view' ? 'Kéo di chuyển phòng/cụm phòng' : 'Di chuyển vùng',
              active: drawTool === 'move',
              onClick: () => onSetDrawTool('move'),
              disabled: floorInteractionMode === 'view' && selectedShapes.length === 0,
            })}
            {renderDrawToolButton({
              icon: <X size={16} />,
              label: 'Bỏ chọn',
              description: floorInteractionMode === 'view'
                ? 'Bỏ chọn toàn bộ phòng đang được chọn trên sơ đồ.'
                : 'Xóa vùng đang chọn để bạn chọn lại từ đầu.',
              onClick: onClearSelection,
              disabled: floorInteractionMode === 'view' ? selectedShapes.length === 0 : selectedCellsSize === 0,
            })}
            {renderDrawToolButton({
              icon: <Trash size={16} />,
              label: floorInteractionMode === 'view' ? 'Xóa vùng phòng' : 'Xóa vùng',
              description: floorInteractionMode === 'view'
                ? 'Gỡ vùng phòng khỏi sơ đồ nhưng không xóa phòng nghiệp vụ trong hệ thống.'
                : 'Xóa nhanh vùng đang chọn khỏi lưới hiện tại.',
              onClick: onDeleteActiveRegion,
              disabled: floorInteractionMode === 'view' ? selectedShapes.length !== 1 : selectedCellsSize === 0,
              danger: true,
            })}
            {floorInteractionMode !== 'add' && renderDrawToolButton({
              icon: <PaintToolIcon size={16} />,
              label: 'Tô màu',
              active: drawTool === 'paint',
              onClick: () => onSetDrawTool('paint'),
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
                  onChange={(event) => onPaintColorChange(event.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span>{currentPaintColor.toUpperCase()}</span>
              </label>
            )}
            {floorInteractionMode === 'add' && (
              <button
                type="button"
                onClick={onExitInteractionMode}
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
                : `Công cụ hiện tại: Kéo chọn vùng tạo phòng. Màu phòng được chọn trong modal khi lưu phòng.${selectedCellsSize > 0 ? ` Đã chọn ${selectedCellsSize} ô trống${isDraggingSelection ? ' và đang kéo chuột để quét vùng.' : '.'}` : ''}`}
          </div>
        </div>
      )}

      {!isImageFloor && isActive && floorInteractionMode === 'edit' && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <span className="rounded-lg bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-700">
            Đang sửa phòng {selectedShape?.roomName || ''}
          </span>
          <button
            type="button"
            onClick={onOpenRoomDraft}
            disabled={selectedCellsSize === 0 || savingLayout}
            className="inline-flex items-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            Lưu phòng
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedCellsSize === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <X size={16} />
            Bỏ chọn vùng
          </button>
          <button
            type="button"
            onClick={onExitInteractionMode}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <X size={16} />
            Hủy sửa
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {drawTool === 'select'
              ? `Kéo chuột để chọn lại phạm vi phòng. Vùng hiện tại có ${selectedCellsSize} ô.`
              : drawTool === 'move'
                ? 'Dùng biểu tượng bàn tay rồi kéo trên vùng đã chọn để di chuyển phòng.'
                : 'Dùng thùng sơn để đổi màu phòng đang chỉnh sửa.'}
          </span>
        </div>
      )}

      {!isImageFloor && isActive && floorInteractionMode === 'move' && (
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

      {!isImageFloor && isActive && canvasResizeEnabled && floorInteractionMode === 'view' && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/60 dark:bg-sky-950/20">
          <span className="rounded-lg bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-700">
            Đang đổi kích thước canvas
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Kéo ở viền phải, viền dưới hoặc góc phải dưới. Canvas sẽ tự lưu khi bạn thả chuột.
          </span>
          <button
            type="button"
            onClick={onEndCanvasResize}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <X size={16} />
            Kết thúc
          </button>
        </div>
      )}
    </>
  )
}
