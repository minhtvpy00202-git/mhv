import { resolveAreaTypeDraft } from './areaTypes'
import AreaTypeFields from './AreaTypeFields'
import SearchableSelect from '../../../components/ui/SearchableSelect'

export default function RoomEditorModal({
  selectedShape,
  floorInteractionMode,
  roomDraft,
  locations,
  locationOptionsForRoomModal,
  areaTypeOptions,
  areaTypePresets,
  roomShapeByLocationId,
  onClose,
  onRoomDraftChange,
  onSave,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {!selectedShape
              ? 'Tạo phòng từ vùng chọn'
              : floorInteractionMode === 'edit'
                ? 'Cập nhật phòng sau khi vẽ lại'
                : 'Sửa thông tin phòng'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>

        <div className="grid flex-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Kiểu gán phòng</label>
            <select
              value={roomDraft.mode}
              onChange={(event) => {
                const nextMode = event.target.value
                onRoomDraftChange(
                  nextMode === 'new'
                    ? { mode: 'new', locationId: '' }
                    : { mode: 'existing' },
                )
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="new">Tạo phòng mới</option>
              <option value="existing">Gắn phòng có sẵn</option>
            </select>
          </div>

          {roomDraft.mode === 'existing' ? (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phòng có sẵn</label>
              <SearchableSelect
                value={roomDraft.locationId}
                onChange={(nextValue) => {
                  const nextLocationId = String(nextValue || '')
                  const selectedLocation = locations.find((item) => String(item.id) === String(nextLocationId))
                  const linkedShape = roomShapeByLocationId?.get?.(Number(nextLocationId))
                  const areaTypeSource = linkedShape || selectedLocation || {
                    roomName: roomDraft.roomName,
                    areaTypeKey: roomDraft.areaTypeKey || '',
                    areaTypeLabel: roomDraft.areaTypeLabel || '',
                  }
                  const areaTypeDraft = resolveAreaTypeDraft(areaTypeSource, areaTypePresets)
                  onRoomDraftChange({
                    locationId: nextLocationId,
                    areaTypeKey: areaTypeDraft.areaTypeKey,
                    areaTypeLabel: areaTypeDraft.areaTypeLabel,
                    areaGroupKey: areaTypeDraft.areaGroupKey,
                    areaGroupLabel: areaTypeDraft.areaGroupLabel,
                  })
                }}
                options={locationOptionsForRoomModal}
                getOptionValue={(location) => location.id}
                getOptionLabel={(location) => location.roomName}
                placeholder={locationOptionsForRoomModal.length === 0 ? 'Không còn phòng trống để gắn' : 'Gõ để tìm phòng'}
                emptyOptionLabel={locationOptionsForRoomModal.length === 0 ? undefined : 'Chọn phòng'}
                emptyText="Không có phòng phù hợp."
                inputClassName="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Chỉ hiển thị các phòng trên tầng này chưa được vẽ sơ đồ để tránh gán trùng.
              </p>
            </div>
          ) : (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên phòng mới</label>
              <input
                value={roomDraft.roomName}
                onChange={(event) => onRoomDraftChange({ roomName: event.target.value })}
                placeholder="Ví dụ: P.201 hoặc Kho thiết bị"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          <AreaTypeFields
            draft={roomDraft}
            onDraftChange={onRoomDraftChange}
            areaTypeOptions={areaTypeOptions}
            areaTypePresets={areaTypePresets}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Màu phòng</label>
            <input
              type="color"
              value={roomDraft.colorHex}
              onChange={(event) => onRoomDraftChange({ colorHex: event.target.value })}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="mt-4 flex w-full shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Lưu phòng trên sơ đồ
          </button>
        </div>
      </div>
    </div>
  )
}
