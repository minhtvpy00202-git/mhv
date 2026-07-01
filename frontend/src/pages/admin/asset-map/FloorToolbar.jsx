import {
  IconArrowsMove as Move,
  IconEdit as Edit,
  IconDeviceFloppy as Save,
  IconPlus as Plus,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react'

export default function FloorToolbar({
  isActive,
  floor,
  isImageFloor,
  floorInteractionMode,
  drawTool,
  selectedShapes,
  selectedCellsSize,
  hasImageSelection,
  selectedShape,
  savingLayout,
  currentPaintColor,
  renderDrawToolButton,
  MouseToolIcon,
  HandToolIcon,
  PaintToolIcon,
  imageRectangleTool,
  imagePolygonTool,
  onAddRoom,
  onEditFloor,
  onDeleteFloor,
  onSetDrawTool,
  onClearSelection,
  onDeleteActiveRegion,
  onFinishImagePolygon,
  onOpenRoomDraft,
  onExitInteractionMode,
  onPaintColorChange,
}) {
  if (!isActive) return null

  const canSubmitImageRoom = hasImageSelection || floorInteractionMode === 'edit'
  const canSubmitGridRoom = selectedCellsSize > 0
  const showDrawTools = floorInteractionMode === 'add' || floorInteractionMode === 'edit'

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
        <div className="grid grid-cols-3 gap-2">
          {floorInteractionMode === 'view' && renderDrawToolButton({
            icon: <Plus size={18} />,
            label: 'Thêm phòng',
            active: false,
            onClick: onAddRoom,
          })}
          {floorInteractionMode === 'view' && renderDrawToolButton({
            icon: <Edit size={18} />,
            label: 'Sửa tầng',
            onClick: onEditFloor,
          })}
          {floorInteractionMode === 'view' && renderDrawToolButton({
            icon: <Trash size={18} />,
            label: 'Xóa tầng',
            onClick: onDeleteFloor,
            danger: true,
          })}

          {showDrawTools && isImageFloor && renderDrawToolButton({
            icon: <MouseToolIcon size={18} />,
            label: 'Vẽ rectangle',
            active: drawTool === imageRectangleTool,
            onClick: () => onSetDrawTool(imageRectangleTool),
          })}
          {showDrawTools && isImageFloor && renderDrawToolButton({
            icon: <Edit size={18} />,
            label: 'Vẽ polygon',
            active: drawTool === imagePolygonTool,
            onClick: () => onSetDrawTool(imagePolygonTool),
          })}
          {showDrawTools && !isImageFloor && renderDrawToolButton({
            icon: <MouseToolIcon size={18} />,
            label: 'Quét vùng',
            active: drawTool === 'select',
            onClick: () => onSetDrawTool('select'),
          })}
          {showDrawTools && !isImageFloor && renderDrawToolButton({
            icon: <HandToolIcon size={18} />,
            label: 'Di chuyển vùng',
            active: drawTool === 'move',
            onClick: () => onSetDrawTool('move'),
            disabled: floorInteractionMode === 'add' && selectedCellsSize === 0,
          })}
          {showDrawTools && !isImageFloor && renderDrawToolButton({
            icon: <PaintToolIcon size={18} />,
            label: 'Tô màu',
            active: drawTool === 'paint',
            onClick: () => onSetDrawTool('paint'),
            disabled: floorInteractionMode === 'add' ? selectedCellsSize === 0 : false,
          })}
          {showDrawTools && isImageFloor && drawTool === imagePolygonTool && renderDrawToolButton({
            icon: <Save size={18} />,
            label: 'Chốt polygon',
            onClick: onFinishImagePolygon,
            disabled: !hasImageSelection,
          })}
          {showDrawTools && renderDrawToolButton({
            icon: <Save size={18} />,
            label: floorInteractionMode === 'edit' ? 'Lưu phòng' : 'Tạo phòng từ vùng chọn',
            onClick: onOpenRoomDraft,
            disabled: isImageFloor ? !canSubmitImageRoom || savingLayout : !canSubmitGridRoom || savingLayout,
          })}
          {renderDrawToolButton({
            icon: <X size={18} />,
            label: floorInteractionMode === 'view' ? 'Bỏ chọn' : 'Xóa vùng chọn',
            onClick: onClearSelection,
            disabled: floorInteractionMode === 'view'
              ? selectedShapes.length === 0
              : (isImageFloor ? !hasImageSelection && !selectedShape : selectedCellsSize === 0),
          })}
          {renderDrawToolButton({
            icon: <Trash size={18} />,
            label: 'Xóa vùng',
            onClick: onDeleteActiveRegion,
            disabled: floorInteractionMode === 'view' ? selectedShapes.length !== 1 : false,
            danger: true,
          })}
          {showDrawTools && renderDrawToolButton({
            icon: <X size={18} />,
            label: floorInteractionMode === 'edit' ? 'Hủy sửa' : 'Thoát chế độ vẽ',
            onClick: onExitInteractionMode,
          })}
        </div>

        {showDrawTools && !isImageFloor && (
          <div className="mt-3 flex justify-center">
            <label
              title="Chọn màu tô"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              <input
                type="color"
                value={currentPaintColor}
                onChange={(event) => onPaintColorChange(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
