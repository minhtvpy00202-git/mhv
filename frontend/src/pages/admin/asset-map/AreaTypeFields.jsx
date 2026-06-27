import { CUSTOM_AREA_TYPE_KEY, buildAreaGroupOptions, isCustomAreaTypeKey } from './areaTypes'
import SearchableSelect from '../../../components/ui/SearchableSelect'

export default function AreaTypeFields({
  draft,
  onDraftChange,
  areaTypeOptions,
  areaTypePresets,
}) {
  const presetByKey = new Map((areaTypePresets || []).map((preset) => [preset.typeKey || preset.key, preset]))
  const isCustomType = isCustomAreaTypeKey(draft.areaTypeKey)
  const areaTypeSelectValue = (areaTypeOptions || []).some((option) => option.key === draft.areaTypeKey)
    ? draft.areaTypeKey
    : (isCustomType ? CUSTOM_AREA_TYPE_KEY : (draft.areaTypeKey || ''))
  const isCreatingCustomType = areaTypeSelectValue === CUSTOM_AREA_TYPE_KEY || draft.areaTypeKey === CUSTOM_AREA_TYPE_KEY
  const selectedPreset = presetByKey.get(draft.areaTypeKey)
  const customGroupOptions = buildAreaGroupOptions(areaTypePresets)

  return (
    <>
      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Loại khu vực</label>
        <SearchableSelect
          value={areaTypeSelectValue}
          onChange={(nextValue) => {
            const nextAreaTypeKey = String(nextValue || '')
            if (nextAreaTypeKey === CUSTOM_AREA_TYPE_KEY) {
              onDraftChange({
                areaTypeKey: CUSTOM_AREA_TYPE_KEY,
                areaTypeLabel: isCustomType ? draft.areaTypeLabel : '',
                areaGroupKey: isCustomType ? draft.areaGroupKey : '',
                areaGroupLabel: isCustomType ? draft.areaGroupLabel : '',
              })
              return
            }

            const selectedOption = areaTypeOptions.find((option) => option.key === nextAreaTypeKey)
            onDraftChange({
              areaTypeKey: nextAreaTypeKey,
              areaTypeLabel: selectedOption?.label || '',
              areaGroupKey: selectedOption?.areaGroupKey || '',
              areaGroupLabel: selectedOption?.areaGroupLabel || '',
            })
          }}
          options={areaTypeOptions}
          getOptionValue={(option) => option.key}
          getOptionLabel={(option) => option.label}
          getOptionDescription={(option) => option.key === CUSTOM_AREA_TYPE_KEY ? 'Tự thêm loại khu vực mới' : option.areaGroupLabel || ''}
          getOptionSearchText={(option) => `${option.label} ${option.areaGroupLabel || ''}`}
          placeholder="Gõ để tìm loại khu vực"
          emptyOptionLabel="Chọn loại khu vực"
          inputClassName="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {selectedPreset
            ? `${selectedPreset.label} thuộc nhóm ${selectedPreset.areaGroupLabel || 'không gian khác'}.`
            : 'Chọn loại khu vực rõ nghĩa để báo cáo và tìm kiếm tài sản sau này chính xác hơn.'}
        </p>
      </div>

      {isCreatingCustomType && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nhóm khu vực</label>
            <SearchableSelect
              value={draft.areaGroupLabel || ''}
              onChange={(nextValue) => {
                const nextGroupLabel = String(nextValue || '')
                const selectedGroup = customGroupOptions.find((option) => option.label === nextGroupLabel)
                onDraftChange({
                  areaTypeKey: CUSTOM_AREA_TYPE_KEY,
                  areaGroupKey: selectedGroup?.key || '',
                  areaGroupLabel: nextGroupLabel,
                })
              }}
              options={customGroupOptions}
              getOptionValue={(option) => option.label}
              getOptionLabel={(option) => option.label}
              placeholder="Gõ để tìm nhóm khu vực"
              emptyOptionLabel="Chọn nhóm khu vực"
              inputClassName="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên loại khu vực mới</label>
            <input
              value={draft.areaTypeLabel}
              onChange={(event) => onDraftChange({ areaTypeKey: CUSTOM_AREA_TYPE_KEY, areaTypeLabel: event.target.value })}
              placeholder="Ví dụ: Studio thu âm, Khu trải nghiệm, Phòng tư vấn"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </>
      )}

      {!isCreatingCustomType && (
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          {selectedPreset
            ? `Nhóm ${selectedPreset.areaGroupLabel || 'khác'} giúp hệ thống gom báo cáo và thống kê tài sản chính xác hơn.`
            : 'Loại khu vực đã chọn sẽ được dùng để lọc, thống kê và hiển thị nhất quán trong toàn hệ thống.'}
        </div>
      )}
    </>
  )
}
