import {
  IconAlertTriangle as AlertTriangle,
  IconBoxMultiple as Boxes,
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconChevronRight as ChevronRight,
  IconDownload as Download,
  IconFileDescription as Detail,
  IconHistory as History,
  IconPackage as Package,
  IconPackageImport as PackagePlus,
  IconPlus as Plus,
  IconPrinter as Printer,
  IconUpload as Upload,
  IconFileSpreadsheet as FileSpreadsheet,
  IconQrcode as QrCode,
  IconRefresh as RefreshCw,
  IconSearch as Search,
  IconSend as Send,
  IconTool as Wrench,
  IconTrash as Trash2,
  IconX as X,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../api/axiosClient";
import AssetRepairTimelineModal from "../../components/AssetRepairTimelineModal";
import ActionIconButton from "../../components/ui/ActionIconButton";
import ModalOverlay from "../../components/ui/ModalOverlay";
import ColumnVisibilityDropdown from "../../components/ui/ColumnVisibilityDropdown";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { useAuth } from "../../context/AuthContext";
import useColumnVisibility from "../../hooks/useColumnVisibility";
import useDebouncedEffect from "../../hooks/useDebouncedEffect";
import {
  mergeSpecEntries,
  normalizeSpecTemplates,
  parseSpecsToEntries,
  stringifySpecs,
} from "../../utils/assetSpecs";
import {
  getAssetStatusLabel,
  getTechnicalStatusLabel,
  getUsageStatusLabel,
  itemizedStatusOptions,
  technicalStatusOptions,
  usageStatusOptions,
} from "../../utils/assetStatus";
import { formatVietnamDate, formatVietnamDateTime } from "../../utils/datetime";
import {
  validateAssetForm,
  validateSupplierForm,
} from "../../utils/validation";
import ConsumableRoomsTab from "./consumables/ConsumableRoomsTab";
import ConsumableDisposalTab from "./consumables/ConsumableDisposalTab";
import ConsumableRequestsTab from "./consumables/ConsumableRequestsTab";
import {
  formatConsumableQuantityText,
  getConsumableRetailUnit,
} from "./consumables/consumableDisplayUtils";
import useLocationOverview, {
  ALL_ROOMS_ID,
} from "./consumables/useLocationOverview";

const consumableStatusOptions = ["Còn hàng", "Cần nhập"];
const managementTabs = [
  {
    value: "ITEMIZED",
    label: "Tài sản cố định",
    description:
      "Quản lý từng thiết bị riêng lẻ, có QR, bảo hành, lịch sử sửa chữa và mượn trả.",
  },
  {
    value: "CONSUMABLE",
    label: "Vật tư tiêu hao",
    description:
      "Quản lý theo số lượng tồn kho, đơn giá và các lần cấp phát cho phòng ban.",
  },
];
const PAGE_SIZE = 10;
const defaultPageInfo = {
  page: 0,
  size: PAGE_SIZE,
  totalPages: 1,
  totalItems: 0,
};
const defaultConsumableStatusCounts = {
  all: 0,
  healthy: 0,
  restock: 0,
};
const defaultItemizedSortState = {
  key: "createdAt",
  direction: "desc",
};
const defaultConsumableSortState = {
  key: "qaCode",
  direction: "asc",
};
const CONSUMABLE_WORKSPACES = new Set([
  "OVERVIEW",
  "WAREHOUSES",
  "ROOMS",
  "DISPOSAL",
  "REQUESTS",
]);
const CONSUMABLE_WORKSPACE_META = {
  OVERVIEW: {
    title: "Danh sách vật tư",
    description:
      "Vật tư tiêu hao theo dạng danh sách tổng hợp để theo dõi tồn kho, nhập hàng và cấp phát.",
    allowInventoryActions: true,
  },
  WAREHOUSES: {
    title: "Kho vật tư",
    description:
      "Theo dõi tồn kho theo từng kho lưu trữ, chọn kho để nhập hàng và rà soát số lượng hiện có.",
    allowInventoryActions: true,
  },
  ROOMS: {
    title: "Theo dõi theo phòng",
    description:
      "Theo dõi lượng vật tư đã cấp phát cho từng phòng, đồng thời xử lý yêu cầu sử dụng và điều chỉnh tồn thực tế.",
    allowInventoryActions: false,
  },
  DISPOSAL: {
    title: "Tiêu huỷ vật tư",
    description:
      "Tạo phiếu tiêu huỷ theo lô, rà soát hạn sử dụng và theo dõi lịch sử xử lý vật tư cần huỷ.",
    allowInventoryActions: false,
  },
  REQUESTS: {
    title: "Phiếu chờ duyệt",
    description:
      "Duyệt hoặc từ chối các yêu cầu cấp phát, sử dụng và tiêu huỷ vật tư đang chờ xử lý.",
    allowInventoryActions: false,
  },
};

function normalizeConsumableWorkspace(workspace, isAdminUser) {
  const normalized = String(workspace || "")
    .trim()
    .toUpperCase();
  if (!normalized || !CONSUMABLE_WORKSPACES.has(normalized)) return "OVERVIEW";
  if (normalized === "REQUESTS" && !isAdminUser) return "OVERVIEW";
  return normalized;
}

const itemizedAssetColumnOptions = [
  { key: "qaCode", label: "Mã QA" },
  { key: "name", label: "Tên thiết bị" },
  { key: "category", label: "Loại" },
  { key: "homeLocationName", label: "Vị trí gốc" },
  { key: "currentLocationName", label: "Vị trí hiện tại" },
  { key: "status", label: "Tình trạng kỹ thuật" },
  { key: "usageStatus", label: "Trạng thái sử dụng" },
  { key: "specs", label: "Thuộc tính" },
  { key: "origin", label: "Nguồn gốc tài sản" },
  { key: "actions", label: "Thao tác" },
];
const defaultItemizedAssetVisibleColumnKeys = [
  "qaCode",
  "name",
  "homeLocationName",
  "currentLocationName",
  "status",
  "usageStatus",
  "actions",
];
const disposalModalLotColumnOptions = [
  { key: "selected", label: "Chọn" },
  { key: "lotCode", label: "Lô hàng" },
  { key: "receivedDate", label: "Ngày nhập" },
  { key: "expirationDate", label: "Hạn sử dụng" },
  { key: "quantityRemaining", label: "Còn lại" },
  { key: "quantityRequested", label: "Số lượng huỷ" },
];
const defaultDisposalModalLotVisibleColumnKeys = [
  "selected",
  "lotCode",
  "expirationDate",
  "quantityRemaining",
  "quantityRequested",
];
const disposalDecisionLotColumnOptions = [
  { key: "lotCode", label: "Lô" },
  { key: "expirationDate", label: "HSD" },
  { key: "quantityRequested", label: "Số lượng huỷ" },
];
const defaultDisposalDecisionLotVisibleColumnKeys = [
  "lotCode",
  "expirationDate",
  "quantityRequested",
];
const disposalHistoryLotColumnOptions = [
  { key: "lotCode", label: "Lô" },
  { key: "receivedDate", label: "Ngày nhập" },
  { key: "expirationDate", label: "HSD" },
  { key: "quantityRequested", label: "Số lượng huỷ" },
];
const defaultDisposalHistoryLotVisibleColumnKeys = [
  "lotCode",
  "receivedDate",
  "expirationDate",
  "quantityRequested",
];

function createDefaultConfirmDialog() {
  return {
    open: false,
    title: "",
    message: "",
    confirmLabel: "Xóa",
    cancelLabel: "Hủy",
    tone: "danger",
    busy: false,
    onConfirm: null,
  };
}

function handleColumnToggleWithGuard(
  columnKey,
  visibleColumns,
  selectedCount,
  toggleColumn,
) {
  if (visibleColumns[columnKey] && selectedCount === 1) {
    toast.info("Cần giữ lại ít nhất 1 cột hiển thị.");
    return;
  }
  toggleColumn(columnKey);
}

function getCategoryLabel(category) {
  return category?.description || category?.name || "";
}

function getSupplierLabel(supplier) {
  return supplier?.name || "";
}

function formatCurrency(value) {
  if (value == null || value === "") return "Chưa cập nhật";
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return String(value);
  return `${numericValue.toLocaleString("vi-VN")} VND`;
}

function formatCurrencyCompact(value) {
  if (value == null || value === "") return null;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return null;
  return `${numericValue.toLocaleString("vi-VN")}₫`;
}

function normalizePurchasePriceInput(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPurchasePriceInput(value) {
  const normalizedValue = normalizePurchasePriceInput(value);
  if (!normalizedValue) return "";
  return normalizedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(value) {
  return formatVietnamDate(value, "Chưa cập nhật");
}

function formatDateTime(value) {
  return formatVietnamDateTime(value, "Chưa cập nhật");
}

function getActorName(stock) {
  return (
    stock?.lastUpdatedByFullName ||
    stock?.lastUpdatedByUsername ||
    "Chưa cập nhật"
  );
}

function getTrackingModeLabel(value) {
  return value === "CONSUMABLE" ? "Tiêu hao" : "Cố định";
}

function isConsumableMode(value) {
  return (
    String(value || "ITEMIZED")
      .trim()
      .toUpperCase() === "CONSUMABLE"
  );
}

function getDefaultSortState(trackingMode) {
  return isConsumableMode(trackingMode)
    ? defaultConsumableSortState
    : defaultItemizedSortState;
}

function getSpecLabelByTrackingMode(value) {
  return isConsumableMode(value) ? "Thông số" : "Đặc tính kỹ thuật";
}

function getSpecTemplateLabelByTrackingMode(value) {
  return isConsumableMode(value) ? "Thông số" : "Thông số kỹ thuật";
}

function getSpecAddButtonLabelByTrackingMode(value) {
  return isConsumableMode(value)
    ? "Thêm thông số tùy chỉnh"
    : "Thêm thông số kỹ thuật tùy chỉnh";
}

function getSpecNamePlaceholderByTrackingMode(value) {
  return isConsumableMode(value) ? "Tên thông số" : "Tên thuộc tính";
}

function getSpecValuePlaceholderByTrackingMode(value) {
  return isConsumableMode(value) ? "Giá trị thông số" : "Giá trị thuộc tính";
}

function getEmptySpecEntriesMessageByTrackingMode(value) {
  return isConsumableMode(value)
    ? "Chọn loại vật tư để hệ thống gợi ý các thông số phù hợp."
    : "Chọn loại thiết bị để hệ thống gợi ý các đặc tính kỹ thuật phù hợp.";
}

function normalizeCategoryKind(value) {
  return String(value || "ITEMIZED")
    .trim()
    .toUpperCase() === "CONSUMABLE"
    ? "CONSUMABLE"
    : "ITEMIZED";
}

function categoryMatchesTrackingMode(category, trackingMode) {
  const categoryKind = normalizeCategoryKind(category?.categoryKind);
  return isConsumableMode(trackingMode)
    ? categoryKind === "CONSUMABLE"
    : categoryKind === "ITEMIZED";
}

function calculateInventoryValue(asset) {
  const unitPrice = Number(asset?.purchasePrice);
  if (Number.isNaN(unitPrice) || unitPrice <= 0) return null;
  const quantityOnHand = Number(asset?.quantityOnHand ?? 0);
  if (Number.isNaN(quantityOnHand) || quantityOnHand < 0) return null;
  return unitPrice * quantityOnHand;
}

function getConsumableInventoryState(asset) {
  const quantityOnHand = Number(asset?.quantityOnHand ?? 0);
  const minimumStock = Number(asset?.minimumStock ?? 0);
  if (Number.isNaN(quantityOnHand)) {
    return { queryStatus: "Cần nhập", label: "Cần nhập", tone: "red" };
  }
  if (
    !Number.isNaN(minimumStock) &&
    minimumStock > 0 &&
    quantityOnHand <= minimumStock
  ) {
    return {
      queryStatus: "Cần nhập",
      label: "Cần nhập",
      tone: quantityOnHand <= 0 ? "red" : "amber",
    };
  }
  return { queryStatus: "Còn hàng", label: "Đủ dùng", tone: "emerald" };
}

function getConsumableWholesaleUnit(asset) {
  return String(
    asset?.wholesaleUnit || asset?.retailUnit || asset?.unit || "đơn vị",
  ).trim();
}

function getConsumableQuantityInputUnit(asset, quantityUnit = "RETAIL") {
  return quantityUnit === "WHOLESALE"
    ? getConsumableWholesaleUnit(asset)
    : getConsumableRetailUnit(asset);
}

function getStatusBadgeClass(tone) {
  if (tone === "slate")
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  if (tone === "red") return "bg-red-100 text-red-700 ring-1 ring-red-200";
  if (tone === "amber")
    return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}

function parseDateOnly(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getConsumableExpiryState(asset) {
  if (!asset?.expiryTrackingEnabled) {
    return {
      label: "Không quản lý",
      tone: "slate",
      dateLabel: "Không áp dụng",
    };
  }
  if (!asset?.expirationDate) {
    return {
      label: "Chưa cập nhật",
      tone: "amber",
      dateLabel: "Chưa cập nhật",
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expirationDate = parseDateOnly(asset.expirationDate);
  if (!expirationDate) {
    return {
      label: "Chưa cập nhật",
      tone: "amber",
      dateLabel: "Chưa cập nhật",
    };
  }
  const diffDays = Math.round(
    (expirationDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays < 0) {
    return {
      label: "Đã hết hạn",
      tone: "red",
      dateLabel: formatDate(asset.expirationDate),
    };
  }
  if (diffDays === 0) {
    return {
      label: "Hết hạn hôm nay",
      tone: "red",
      dateLabel: formatDate(asset.expirationDate),
    };
  }
  if (diffDays <= 30) {
    return {
      label: "Sắp hết hạn",
      tone: "amber",
      dateLabel: formatDate(asset.expirationDate),
    };
  }
  return {
    label: "Còn hạn",
    tone: "emerald",
    dateLabel: formatDate(asset.expirationDate),
  };
}

function getConsumableExpiryGroupKey(expirationDate) {
  return expirationDate || "__NO_EXPIRY__";
}

function buildConsumableExpiryGroups(asset, detail) {
  const receiptLots = Array.isArray(detail?.receiptLots)
    ? detail.receiptLots
    : [];
  const activeLots = receiptLots.filter(
    (lot) => Number(lot?.quantityRemaining ?? 0) > 0,
  );

  if (activeLots.length === 0) {
    return [
      {
        key: `${asset.qaCode}-fallback`,
        expirationDate: asset?.expiryTrackingEnabled
          ? asset.expirationDate || null
          : null,
        quantityOnHand: Number(asset?.quantityOnHand ?? 0),
        purchasePrice: asset?.purchasePrice ?? null,
        lotCount: 0,
      },
    ];
  }

  const groupedMap = new Map();
  activeLots.forEach((lot) => {
    const expirationDate = asset?.expiryTrackingEnabled
      ? lot.expirationDate || null
      : null;
    const groupKey = getConsumableExpiryGroupKey(expirationDate);
    const quantityRemaining = Number(lot?.quantityRemaining ?? 0);
    const unitPrice = Number(lot?.unitPrice ?? 0);
    const existingGroup = groupedMap.get(groupKey) || {
      key: `${asset.qaCode}-${groupKey}`,
      expirationDate,
      quantityOnHand: 0,
      totalValue: 0,
      lotCount: 0,
    };
    existingGroup.quantityOnHand += Number.isNaN(quantityRemaining)
      ? 0
      : quantityRemaining;
    existingGroup.totalValue +=
      Number.isNaN(quantityRemaining) || Number.isNaN(unitPrice)
        ? 0
        : quantityRemaining * unitPrice;
    existingGroup.lotCount += 1;
    groupedMap.set(groupKey, existingGroup);
  });

  return Array.from(groupedMap.values())
    .map((group) => ({
      key: group.key,
      expirationDate: group.expirationDate,
      quantityOnHand: group.quantityOnHand,
      purchasePrice:
        group.quantityOnHand > 0
          ? group.totalValue / group.quantityOnHand
          : null,
      lotCount: group.lotCount,
    }))
    .sort((left, right) => {
      const leftDate = parseDateOnly(left.expirationDate);
      const rightDate = parseDateOnly(right.expirationDate);
      if (!leftDate && !rightDate) return 0;
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return leftDate.getTime() - rightDate.getTime();
    });
}

function buildWarehouseOptionsFromAssetDetail(detail, fallbackLocations = []) {
  const receiptLots = Array.isArray(detail?.receiptLots)
    ? detail.receiptLots
    : [];
  const grouped = new Map();

  receiptLots
    .filter(
      (lot) =>
        Number(lot?.quantityRemaining ?? 0) > 0 && lot?.warehouseLocationId,
    )
    .forEach((lot) => {
      const key = String(lot.warehouseLocationId);
      const previous = grouped.get(key) || {
        id: lot.warehouseLocationId,
        roomName:
          lot.warehouseLocationName || `Kho #${lot.warehouseLocationId}`,
        quantityRemaining: 0,
        lotCount: 0,
      };
      previous.quantityRemaining += Number(lot?.quantityRemaining ?? 0);
      previous.lotCount += 1;
      grouped.set(key, previous);
    });

  if (grouped.size > 0) {
    return Array.from(grouped.values()).sort((left, right) =>
      String(left.roomName || "").localeCompare(
        String(right.roomName || ""),
        "vi",
      ),
    );
  }

  const fallbackWarehouseId = detail?.homeLocationId || detail?.locationId;
  const fallbackWarehouseName =
    detail?.homeLocationName || detail?.locationName;
  if (fallbackWarehouseId && fallbackWarehouseName) {
    return [
      {
        id: fallbackWarehouseId,
        roomName: fallbackWarehouseName,
        quantityRemaining: Number(detail?.quantityOnHand ?? 0),
        lotCount: 0,
      },
    ];
  }

  return (fallbackLocations || [])
    .filter((location) =>
      Boolean(location?.isStorageWarehouse ?? location?.storageWarehouse),
    )
    .map((location) => ({
      id: location.id,
      roomName: location.roomName,
      quantityRemaining: 0,
      lotCount: 0,
    }));
}

function getConsumableRequestStatusMeta(status) {
  const normalizedStatus = String(status || "PENDING")
    .trim()
    .toUpperCase();
  if (normalizedStatus === "APPROVED") {
    return {
      label: "Đã cấp phát",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (normalizedStatus === "REJECTED") {
    return {
      label: "Từ chối",
      className: "bg-red-100 text-red-700",
    };
  }
  return {
    label: "Chờ duyệt",
    className: "bg-amber-100 text-amber-700",
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getFieldClass(hasError) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-fptOrange placeholder:text-slate-400 focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 ${hasError ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-slate-300 dark:border-slate-700"}`;
}

function getInitialTrackingMode(initialSection, restrictToConsumable) {
  if (restrictToConsumable) return "CONSUMABLE";
  return initialSection === "consumables" ? "CONSUMABLE" : "ITEMIZED";
}

function AssetManagement({
  restrictToConsumable = false,
  initialSection = "fixed",
  showTabSwitcher = false,
  initialConsumableWorkspace = null,
}) {
  const initialTrackingMode = getInitialTrackingMode(
    initialSection,
    restrictToConsumable,
  );
  const initialDefaultSortState = getDefaultSortState(initialTrackingMode);
  const specEntryIdRef = useRef(0);
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryDetailsById, setCategoryDetailsById] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [qrModalImage, setQrModalImage] = useState("");
  const [qrModalQaCode, setQrModalQaCode] = useState("");
  const [qrModalAssetName, setQrModalAssetName] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalLoading, setQrModalLoading] = useState(false);
  const [bulkQrPrinting, setBulkQrPrinting] = useState(false);
  const [qrSelectionMode, setQrSelectionMode] = useState(false);
  const [selectedQrQaCodes, setSelectedQrQaCodes] = useState(() => new Set());
  const [selectedQrAssetCache, setSelectedQrAssetCache] = useState({});
  const [showBulkQrPreview, setShowBulkQrPreview] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineAsset, setTimelineAsset] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(
    createDefaultConfirmDialog,
  );
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [selectedSpecsAsset, setSelectedSpecsAsset] = useState(null);
  const [showOriginModal, setShowOriginModal] = useState(false);
  const [selectedOriginAsset, setSelectedOriginAsset] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedIssueAsset, setSelectedIssueAsset] = useState(null);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedReceiveAsset, setSelectedReceiveAsset] = useState(null);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    quantity: "",
    quantityUnit: "WHOLESALE",
    unitPrice: "",
    supplierId: "",
    warehouseLocationId: "",
    lotCode: "",
    receivedDate: "",
    expirationDate: "",
    note: "",
  });
  const [issueHistoryLoading, setIssueHistoryLoading] = useState(false);
  const [issueHistory, setIssueHistory] = useState([]);
  const [issueLocationStocks, setIssueLocationStocks] = useState([]);
  const [issueForm, setIssueForm] = useState({
    issuedToLocationId: "",
    sourceWarehouseLocationId: "",
    quantity: "",
    note: "",
  });
  const [showConsumableRequestModal, setShowConsumableRequestModal] =
    useState(false);
  const [consumableRequestSubmitting, setConsumableRequestSubmitting] =
    useState(false);
  const [selectedRequestAssetQaCode, setSelectedRequestAssetQaCode] =
    useState("");
  const [consumableRequestLocationId, setConsumableRequestLocationId] =
    useState("");
  const [consumableRequestForm, setConsumableRequestForm] = useState({
    assetQaCode: "",
    sourceWarehouseLocationId: "",
    quantityRequested: "",
    reason: "",
  });
  const [pendingConsumableRequests, setPendingConsumableRequests] = useState(
    [],
  );
  const [
    pendingConsumableRequestsLoading,
    setPendingConsumableRequestsLoading,
  ] = useState(false);
  const [showConsumableDecisionModal, setShowConsumableDecisionModal] =
    useState(false);
  const [consumableDecisionSubmitting, setConsumableDecisionSubmitting] =
    useState(false);
  const [selectedConsumableRequest, setSelectedConsumableRequest] =
    useState(null);
  const [consumableDecisionAction, setConsumableDecisionAction] =
    useState("APPROVE");
  const [
    consumableDecisionSourceWarehouseLocationId,
    setConsumableDecisionSourceWarehouseLocationId,
  ] = useState("");
  const [consumableDecisionNote, setConsumableDecisionNote] = useState("");
  const [expiredLots, setExpiredLots] = useState([]);
  const [expiredLotsLoading, setExpiredLotsLoading] = useState(false);
  const [showDisposalRequestModal, setShowDisposalRequestModal] =
    useState(false);
  const [selectedExpiredLot, setSelectedExpiredLot] = useState(null);
  const [disposalRequestForm, setDisposalRequestForm] = useState({
    reason: "Do hết hạn sử dụng.",
    items: [],
  });
  const [disposalRequestSubmitting, setDisposalRequestSubmitting] =
    useState(false);
  const [disposalRequests, setDisposalRequests] = useState([]);
  const [disposalRequestsLoading, setDisposalRequestsLoading] = useState(false);
  const [disposalHistoryFilters, setDisposalHistoryFilters] = useState({
    status: "",
    keyword: "",
  });
  const [disposalHistoryPage, setDisposalHistoryPage] = useState(0);
  const DISPOSAL_PAGE_SIZE = 10;
  const [pendingDisposalRequests, setPendingDisposalRequests] = useState([]);
  const [pendingDisposalRequestsLoading, setPendingDisposalRequestsLoading] =
    useState(false);
  const [showDisposalDecisionModal, setShowDisposalDecisionModal] =
    useState(false);
  const [selectedDisposalRequest, setSelectedDisposalRequest] = useState(null);
  const [disposalDecisionAction, setDisposalDecisionAction] =
    useState("APPROVE");
  const [disposalDecisionNote, setDisposalDecisionNote] = useState("");
  const [disposalDecisionSubmitting, setDisposalDecisionSubmitting] =
    useState(false);
  const [downloadingDisposalRequestId, setDownloadingDisposalRequestId] =
    useState(null);
  const [selectedDisposalHistoryRequest, setSelectedDisposalHistoryRequest] =
    useState(null);
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
  const [selectedStockRecord, setSelectedStockRecord] = useState(null);
  const [stockAdjustSubmitting, setStockAdjustSubmitting] = useState(false);
  const [stockAdjustForm, setStockAdjustForm] = useState({
    quantityRemaining: "",
    note: "",
  });
  const [formMode, setFormMode] = useState("create");
  const [selectedQaCode, setSelectedQaCode] = useState(null);
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    address: "",
    phoneNumber: "",
  });
  const [supplierFormErrors, setSupplierFormErrors] = useState({});
  const [activeTab, setActiveTab] = useState(initialTrackingMode);
  const [openActionMenuQaCode, setOpenActionMenuQaCode] = useState(null);
  const [actionMenuPos, setActionMenuPos] = useState({
    top: 0,
    bottom: "auto",
    right: 0,
  });
  const [consumableWorkspace, setConsumableWorkspace] = useState(() =>
    normalizeConsumableWorkspace(
      initialConsumableWorkspace,
      user?.role === "Admin",
    ),
  );
  const [selectedWarehouseLocationId, setSelectedWarehouseLocationId] =
    useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showConsumableAdvancedFilters, setShowConsumableAdvancedFilters] =
    useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importPreviewing, setImportPreviewing] = useState(false);
  const [importCommitting, setImportCommitting] = useState(false);
  const importFileInputRef = useRef(null);
  const [pageInfo, setPageInfo] = useState(defaultPageInfo);
  const [consumableStatusCounts, setConsumableStatusCounts] = useState(
    defaultConsumableStatusCounts,
  );
  const [sortState, setSortState] = useState(initialDefaultSortState);
  const [filters, setFilters] = useState({
    name: "",
    status: "",
    technicalStatus: "",
    usageStatus: "",
    trackingMode: initialTrackingMode,
    categoryId: "",
    locationId: "",
    categoryKeyword: "",
    locationKeyword: "",
  });
  const [itemizedFilterDraft, setItemizedFilterDraft] = useState(filters);
  const [consumableFilterDraft, setConsumableFilterDraft] = useState(filters);
  const [form, setForm] = useState({
    trackingMode: initialTrackingMode,
    name: "",
    categoryId: "",
    locationId: "",
    technicalStatus: "Hoạt động tốt",
    usageStatus: "Tại vị trí gốc",
    supplierId: "",
    purchasePrice: "",
    purchaseDate: "",
    warrantyExpirationDate: "",
    expiryTrackingEnabled: false,
    expirationDate: "",
    quantityOnHand: "",
    quantityOnHandUnit: "RETAIL",
    minimumStock: "",
    minimumStockUnit: "RETAIL",
    retailUnit: "",
    wholesaleUnit: "",
    wholesaleToRetailFactor: "",
    specEntries: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [assetDetailsByQaCode, setAssetDetailsByQaCode] = useState({});
  const activeTrackingMode = activeTab;
  const isConsumableTab = isConsumableMode(activeTrackingMode);
  const isConsumableManager = user?.role === "ConsumableManager";
  const itemizedAssetColumns = useColumnVisibility({
    storageKey: "mhv-admin-assets-itemized-columns",
    columns: itemizedAssetColumnOptions,
    defaultVisibleKeys: defaultItemizedAssetVisibleColumnKeys,
  });
  const disposalModalLotColumns = useColumnVisibility({
    storageKey: "mhv-admin-assets-disposal-modal-lots-columns",
    columns: disposalModalLotColumnOptions,
    defaultVisibleKeys: defaultDisposalModalLotVisibleColumnKeys,
  });
  const disposalDecisionLotColumns = useColumnVisibility({
    storageKey: "mhv-admin-assets-disposal-decision-lots-columns",
    columns: disposalDecisionLotColumnOptions,
    defaultVisibleKeys: defaultDisposalDecisionLotVisibleColumnKeys,
  });
  const disposalHistoryLotColumns = useColumnVisibility({
    storageKey: "mhv-admin-assets-disposal-history-lots-columns",
    columns: disposalHistoryLotColumnOptions,
    defaultVisibleKeys: defaultDisposalHistoryLotVisibleColumnKeys,
  });

  const filteredCategoryOptions = useMemo(() => {
    const keyword = (
      isConsumableTab
        ? filters.categoryKeyword
        : itemizedFilterDraft.categoryKeyword
    )
      .trim()
      .toLowerCase();
    const matchingCategories = categories.filter((category) =>
      categoryMatchesTrackingMode(category, activeTrackingMode),
    );
    if (!keyword) return matchingCategories;
    return matchingCategories.filter((category) =>
      getCategoryLabel(category).toLowerCase().includes(keyword),
    );
  }, [
    activeTrackingMode,
    categories,
    filters.categoryKeyword,
    isConsumableTab,
    itemizedFilterDraft.categoryKeyword,
  ]);
  const sortedLocations = useMemo(
    () =>
      [...locations].sort((left, right) =>
        left.roomName.localeCompare(right.roomName, "vi"),
      ),
    [locations],
  );
  const hasActiveItemizedFilters = useMemo(
    () =>
      Boolean(
        filters.name.trim() ||
        filters.status ||
        filters.technicalStatus ||
        filters.usageStatus ||
        filters.categoryId ||
        filters.locationId ||
        itemizedFilterDraft.name.trim() ||
        itemizedFilterDraft.status ||
        itemizedFilterDraft.technicalStatus ||
        itemizedFilterDraft.usageStatus ||
        itemizedFilterDraft.categoryId ||
        itemizedFilterDraft.locationId,
      ),
    [
      filters.name,
      filters.status,
      filters.technicalStatus,
      filters.usageStatus,
      filters.categoryId,
      filters.locationId,
      itemizedFilterDraft.name,
      itemizedFilterDraft.status,
      itemizedFilterDraft.technicalStatus,
      itemizedFilterDraft.usageStatus,
      itemizedFilterDraft.categoryId,
      itemizedFilterDraft.locationId,
    ],
  );
  const hasActiveConsumableFilters = useMemo(
    () =>
      Boolean(
        filters.name.trim() ||
        filters.status ||
        filters.categoryId ||
        filters.locationId ||
        consumableFilterDraft.name.trim() ||
        consumableFilterDraft.status ||
        consumableFilterDraft.categoryId ||
        consumableFilterDraft.locationId,
      ),
    [
      filters.name,
      filters.status,
      filters.categoryId,
      filters.locationId,
      consumableFilterDraft.name,
      consumableFilterDraft.status,
      consumableFilterDraft.categoryId,
      consumableFilterDraft.locationId,
    ],
  );
  const formCategoryOptions = useMemo(
    () =>
      categories.filter((category) =>
        categoryMatchesTrackingMode(category, form.trackingMode),
      ),
    [categories, form.trackingMode],
  );
  const warehouseLocations = useMemo(
    () =>
      locations.filter((location) =>
        Boolean(location?.isStorageWarehouse ?? location?.storageWarehouse),
      ),
    [locations],
  );
  const defaultConsumableWarehouseLocation = warehouseLocations[0] || null;
  const selectedWarehouseLocation = useMemo(
    () =>
      warehouseLocations.find(
        (location) =>
          String(location.id) === String(selectedWarehouseLocationId),
      ) || null,
    [selectedWarehouseLocationId, warehouseLocations],
  );

  useEffect(() => {
    if (!openActionMenuQaCode) return;
    const handleOutside = () => setOpenActionMenuQaCode(null);
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [openActionMenuQaCode]);

  const itemizedAssetsOnPage = useMemo(
    () => assets.filter((asset) => !isConsumableMode(asset.trackingMode)),
    [assets],
  );
  const selectedQrAssets = useMemo(
    () =>
      [...selectedQrQaCodes]
        .map((qaCode) => selectedQrAssetCache[qaCode])
        .filter(Boolean),
    [selectedQrAssetCache, selectedQrQaCodes],
  );
  const selectedQrCountOnPage = itemizedAssetsOnPage.filter((asset) =>
    selectedQrQaCodes.has(asset.qaCode),
  ).length;
  const allPageQrSelected =
    itemizedAssetsOnPage.length > 0 &&
    selectedQrCountOnPage === itemizedAssetsOnPage.length;
  const somePageQrSelected = selectedQrCountOnPage > 0 && !allPageQrSelected;

  const selectedSpecsEntries = useMemo(
    () => parseSpecsToEntries(selectedSpecsAsset?.specs),
    [selectedSpecsAsset],
  );
  const isEditing = formMode === "update" && Boolean(selectedQaCode);
  const isConsumableForm = isConsumableMode(form.trackingMode);
  const formSpecLabel = getSpecLabelByTrackingMode(form.trackingMode);
  const formSpecTemplateLabel = getSpecTemplateLabelByTrackingMode(
    form.trackingMode,
  );
  const formSpecAddButtonLabel = getSpecAddButtonLabelByTrackingMode(
    form.trackingMode,
  );
  const {
    selectedRoomId,
    roomOverview,
    roomOverviewLoading,
    roomOptions,
    refreshRoomOverview,
    handleRoomChange,
    ensureRoomLoaded,
  } = useLocationOverview({ locations });
  const consumableRequestAssetOptions = useMemo(() => {
    const roomStockOptions = (roomOverview?.stocks || []).map((stock) => ({
      qaCode: stock.assetQaCode,
      name: stock.assetName,
      unit: stock.unit,
    }));
    const inventoryOptions = assets
      .filter((asset) =>
        isConsumableMode(asset?.trackingMode || activeTrackingMode),
      )
      .map((asset) => ({
        qaCode: asset.qaCode,
        name: asset.name,
        unit: asset.unit,
      }));
    const merged = [...roomStockOptions, ...inventoryOptions];
    return merged.filter(
      (option, index, collection) =>
        collection.findIndex((item) => item.qaCode === option.qaCode) === index,
    );
  }, [activeTrackingMode, assets, roomOverview?.stocks]);
  const issueWarehouseOptions = useMemo(
    () =>
      buildWarehouseOptionsFromAssetDetail(
        selectedIssueAsset,
        warehouseLocations,
      ),
    [selectedIssueAsset, warehouseLocations],
  );
  const selectedRequestAssetDetail = useMemo(
    () => assetDetailsByQaCode[selectedRequestAssetQaCode] || null,
    [assetDetailsByQaCode, selectedRequestAssetQaCode],
  );
  const consumableRequestWarehouseOptions = useMemo(
    () =>
      buildWarehouseOptionsFromAssetDetail(
        selectedRequestAssetDetail,
        warehouseLocations,
      ),
    [selectedRequestAssetDetail, warehouseLocations],
  );
  const consumableDecisionWarehouseOptions = useMemo(
    () =>
      buildWarehouseOptionsFromAssetDetail(
        assetDetailsByQaCode[selectedConsumableRequest?.assetQaCode] || null,
        warehouseLocations,
      ),
    [
      assetDetailsByQaCode,
      selectedConsumableRequest?.assetQaCode,
      warehouseLocations,
    ],
  );
  const consumableExpiryGroupsByQaCode = useMemo(
    () =>
      assets.reduce((accumulator, asset) => {
        accumulator[asset.qaCode] = buildConsumableExpiryGroups(
          asset,
          assetDetailsByQaCode[asset.qaCode],
        );
        return accumulator;
      }, {}),
    [assetDetailsByQaCode, assets],
  );
  const filteredDisposalRequests = useMemo(() => {
    const keyword = disposalHistoryFilters.keyword.trim().toLowerCase();
    return disposalRequests.filter((request) => {
      if (
        disposalHistoryFilters.status &&
        request.status !== disposalHistoryFilters.status
      ) {
        return false;
      }
      if (!keyword) return true;
      const haystacks = [
        request.assetName,
        request.assetQaCode,
        request.reason,
        request.requestedByFullName,
        request.requestedByUsername,
        request.lotCode,
        ...(request.items || []).flatMap((item) => [
          item.lotCode,
          item.supplierName,
        ]),
      ];
      return haystacks.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [
    disposalHistoryFilters.keyword,
    disposalHistoryFilters.status,
    disposalRequests,
  ]);

  const disposalHistoryTotalPages = Math.max(
    1,
    Math.ceil(filteredDisposalRequests.length / DISPOSAL_PAGE_SIZE),
  );
  const pagedDisposalRequests = filteredDisposalRequests.slice(
    disposalHistoryPage * DISPOSAL_PAGE_SIZE,
    (disposalHistoryPage + 1) * DISPOSAL_PAGE_SIZE,
  );

  const pendingDisposalCount = useMemo(
    () =>
      disposalRequests.filter(
        (item) => String(item.status || "").toUpperCase() === "PENDING",
      ).length,
    [disposalRequests],
  );

  const handleDisposalHistoryFiltersChange = ({
    keyword,
    status,
    resetPage = false,
  }) => {
    setDisposalHistoryFilters((prev) => ({
      ...prev,
      ...(keyword !== undefined ? { keyword } : {}),
      ...(status !== undefined ? { status } : {}),
    }));
    if (resetPage) {
      setDisposalHistoryPage(0);
    }
  };

  const createSpecEntryWithKey = (entry = {}) => {
    specEntryIdRef.current += 1;
    return {
      ...entry,
      clientKey: `spec-${specEntryIdRef.current}`,
    };
  };

  const withSpecEntryKeys = (entries = []) =>
    entries.map((entry) => createSpecEntryWithKey(entry));

  const getCategorySpecTemplates = async (categoryId) => {
    const normalizedCategoryId = Number(categoryId);
    if (!normalizedCategoryId) return [];
    const cachedDetail = categoryDetailsById[normalizedCategoryId];
    if (cachedDetail) {
      return normalizeSpecTemplates(cachedDetail.specTemplates);
    }
    const response = await axiosClient.get(
      `/api/categories/${normalizedCategoryId}`,
    );
    const detail = response.data || {};
    setCategoryDetailsById((prev) => ({
      ...prev,
      [normalizedCategoryId]: detail,
    }));
    return normalizeSpecTemplates(detail.specTemplates);
  };

  const fetchAssetDetail = async (qaCode) => {
    const cachedDetail = assetDetailsByQaCode[qaCode];
    if (cachedDetail) return cachedDetail;
    const response = await axiosClient.get(`/api/assets/${qaCode}`);
    const detail = response.data || {};
    setAssetDetailsByQaCode((prev) => ({
      ...prev,
      [qaCode]: detail,
    }));
    return detail;
  };

  const buildAssetQueryParams = useCallback(
    (
      page = 0,
      nextFilters = {},
      nextSort = getDefaultSortState(nextFilters.trackingMode),
    ) => {
      const params = {
        page,
        size: PAGE_SIZE,
        sortKey: nextSort.key,
        sortDirection: nextSort.direction,
      };
      if ((nextFilters.name || "").trim())
        params.name = nextFilters.name.trim();
      if (nextFilters.status) params.status = nextFilters.status;
      if (nextFilters.technicalStatus)
        params.technicalStatus = nextFilters.technicalStatus;
      if (nextFilters.usageStatus) params.usageStatus = nextFilters.usageStatus;
      if (nextFilters.trackingMode)
        params.trackingMode = nextFilters.trackingMode;
      if (nextFilters.categoryId)
        params.categoryId = Number(nextFilters.categoryId);
      if (nextFilters.locationId)
        params.locationId = Number(nextFilters.locationId);
      return params;
    },
    [],
  );

  useEffect(() => {
    if (!isConsumableTab || assets.length === 0) return;
    const missingQaCodes = assets
      .map((asset) => asset.qaCode)
      .filter(
        (qaCode) => !Array.isArray(assetDetailsByQaCode[qaCode]?.receiptLots),
      );
    if (missingQaCodes.length === 0) return;
    let cancelled = false;

    const loadMissingAssetDetails = async () => {
      const results = await Promise.allSettled(
        missingQaCodes.map((qaCode) =>
          axiosClient.get(`/api/assets/${qaCode}`),
        ),
      );
      if (cancelled) return;
      setAssetDetailsByQaCode((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[missingQaCodes[index]] = result.value?.data || {};
          }
        });
        return next;
      });
    };

    void loadMissingAssetDetails();
    return () => {
      cancelled = true;
    };
  }, [assetDetailsByQaCode, assets, isConsumableTab]);

  const loadAssets = async (
    page = pageInfo.page,
    nextFilters = filters,
    nextSort = sortState,
  ) => {
    setLoading(true);
    try {
      const response = await axiosClient.get("/api/assets", {
        params: buildAssetQueryParams(page, nextFilters, nextSort),
      });
      const data = response.data || {};
      setAssets(data.items || []);
      setPageInfo({
        page: data.page ?? 0,
        size: data.size ?? pageInfo.size ?? PAGE_SIZE,
        totalPages: data.totalPages || 1,
        totalItems: data.totalItems || 0,
      });
      if (isConsumableMode(nextFilters.trackingMode)) {
        await loadConsumableStatusCounts(nextFilters);
      } else {
        setConsumableStatusCounts(defaultConsumableStatusCounts);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tải danh sách thiết bị.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useDebouncedEffect(
    () => {
      const draft = isConsumableTab
        ? consumableFilterDraft
        : itemizedFilterDraft;
      const nextFilters = {
        ...draft,
        trackingMode: activeTrackingMode,
      };
      setFilters(nextFilters);
      void loadAssets(0, nextFilters);
    },
    [
      activeTrackingMode,
      isConsumableTab,
      itemizedFilterDraft.name,
      itemizedFilterDraft.status,
      itemizedFilterDraft.technicalStatus,
      itemizedFilterDraft.usageStatus,
      itemizedFilterDraft.categoryId,
      itemizedFilterDraft.locationId,
      consumableFilterDraft.name,
      consumableFilterDraft.status,
      consumableFilterDraft.categoryId,
      consumableFilterDraft.locationId,
    ],
    300,
    true,
  );

  const buildConsumableStatusCountFilters = (nextFilters) => ({
    name: nextFilters.name,
    trackingMode: "CONSUMABLE",
    categoryId: nextFilters.categoryId,
    locationId: nextFilters.locationId,
  });

  const loadConsumableStatusCounts = useCallback(
    async (baseFilters) => {
      const countFilters = buildConsumableStatusCountFilters(baseFilters);
      try {
        const [allResponse, healthyResponse, restockResponse] =
          await Promise.all([
            axiosClient.get("/api/assets", {
              params: {
                ...buildAssetQueryParams(
                  0,
                  { ...countFilters, status: "" },
                  defaultConsumableSortState,
                ),
                size: 1,
              },
            }),
            axiosClient.get("/api/assets", {
              params: {
                ...buildAssetQueryParams(
                  0,
                  { ...countFilters, status: "Còn hàng" },
                  defaultConsumableSortState,
                ),
                size: 1,
              },
            }),
            axiosClient.get("/api/assets", {
              params: {
                ...buildAssetQueryParams(
                  0,
                  { ...countFilters, status: "Cần nhập" },
                  defaultConsumableSortState,
                ),
                size: 1,
              },
            }),
          ]);
        setConsumableStatusCounts({
          all: allResponse.data?.totalItems || 0,
          healthy: healthyResponse.data?.totalItems || 0,
          restock: restockResponse.data?.totalItems || 0,
        });
      } catch (error) {
        setConsumableStatusCounts(defaultConsumableStatusCounts);
        const message =
          error?.response?.data?.message ||
          "Không thể tải thống kê trạng thái vật tư.";
        toast.error(message);
      }
    },
    [buildAssetQueryParams],
  );

  const fetchConsumableLocationStocks = async (qaCode) => {
    const response = await axiosClient.get(
      `/api/assets/${qaCode}/location-stocks`,
    );
    return response.data || [];
  };

  const loadPendingConsumableRequests = async () => {
    if (!isAdmin) return;
    setPendingConsumableRequestsLoading(true);
    try {
      const response = await axiosClient.get(
        "/api/assets/consumable-requests",
      );
      setPendingConsumableRequests(response.data || []);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Không thể tải danh sách phiếu cấp phát.";
      toast.error(message);
    } finally {
      setPendingConsumableRequestsLoading(false);
    }
  };

  const loadExpiredLots = async () => {
    setExpiredLotsLoading(true);
    try {
      const response = await axiosClient.get("/api/assets/expired-lots");
      setExpiredLots(response.data || []);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tải danh sách lô hết hạn.";
      toast.error(message);
    } finally {
      setExpiredLotsLoading(false);
    }
  };

  const loadDisposalRequests = async (status = "") => {
    setDisposalRequestsLoading(true);
    try {
      const response = await axiosClient.get("/api/assets/disposal-requests", {
        params: status ? { status } : {},
      });
      setDisposalRequests(response.data || []);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tải lịch sử tiêu huỷ.";
      toast.error(message);
    } finally {
      setDisposalRequestsLoading(false);
    }
  };

  const loadPendingDisposalRequests = async () => {
    if (!isAdmin) return;
    setPendingDisposalRequestsLoading(true);
    try {
      const response = await axiosClient.get("/api/assets/disposal-requests", {
        params: { status: "PENDING" },
      });
      setPendingDisposalRequests(response.data || []);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Không thể tải danh sách yêu cầu tiêu huỷ chờ duyệt.";
      toast.error(message);
    } finally {
      setPendingDisposalRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (
      !isConsumableForm ||
      form.locationId ||
      !defaultConsumableWarehouseLocation?.id
    )
      return;
    const syncStorageLocationTimer = window.setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        locationId: String(defaultConsumableWarehouseLocation.id),
      }));
      setFormErrors((prev) => ({ ...prev, locationId: "" }));
    }, 0);
    return () => window.clearTimeout(syncStorageLocationTimer);
  }, [
    defaultConsumableWarehouseLocation?.id,
    form.locationId,
    isConsumableForm,
  ]);

  useEffect(() => {
    const bootstrapTrackingMode = getInitialTrackingMode(
      initialSection,
      restrictToConsumable,
    );
    const bootstrapSortState = getDefaultSortState(bootstrapTrackingMode);
    const initializePage = async () => {
      try {
        const response = await axiosClient.get("/api/assets/bootstrap", {
          params: {
            page: 0,
            size: PAGE_SIZE,
            trackingMode: bootstrapTrackingMode,
            sortKey: bootstrapSortState.key,
            sortDirection: bootstrapSortState.direction,
          },
        });
        const data = response.data || {};
        const assetPage = data.assets || {};
        setAssets(assetPage.items || []);
        setPageInfo({
          page: assetPage.page ?? 0,
          size: assetPage.size ?? PAGE_SIZE,
          totalPages: assetPage.totalPages || 1,
          totalItems: assetPage.totalItems || 0,
        });
        setLocations(data.locations || []);
        setCategories(data.categories || []);
        setCategoryDetailsById({});
        setAssetDetailsByQaCode({});
        setSuppliers(data.suppliers || []);
        setSortState(bootstrapSortState);
        if (isConsumableMode(bootstrapTrackingMode)) {
          await loadConsumableStatusCounts({
            name: "",
            status: "",
            technicalStatus: "",
            usageStatus: "",
            trackingMode: "CONSUMABLE",
            categoryId: "",
            locationId: "",
            categoryKeyword: "",
            locationKeyword: "",
          });
        } else {
          setConsumableStatusCounts(defaultConsumableStatusCounts);
        }
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          "Không thể tải dữ liệu trang thiết bị.";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void initializePage();
  }, [initialSection, loadConsumableStatusCounts, restrictToConsumable]);

  useEffect(() => {
    if (!isConsumableTab || consumableWorkspace !== "ROOMS") return;
    void ensureRoomLoaded();
  }, [consumableWorkspace, ensureRoomLoaded, isConsumableTab]);

  useEffect(() => {
    if (!isConsumableTab || consumableWorkspace !== "WAREHOUSES") return;
    if (warehouseLocations.length === 0) {
      setSelectedWarehouseLocationId("");
      return;
    }
    setSelectedWarehouseLocationId((previous) => {
      if (
        previous &&
        warehouseLocations.some(
          (location) => String(location.id) === String(previous),
        )
      ) {
        return previous;
      }
      return String(warehouseLocations[0].id);
    });
  }, [consumableWorkspace, isConsumableTab, warehouseLocations]);

  useEffect(() => {
    if (
      !isConsumableTab ||
      consumableWorkspace !== "WAREHOUSES" ||
      !selectedWarehouseLocationId
    )
      return;
    if (
      String(consumableFilterDraft.locationId || "") ===
      String(selectedWarehouseLocationId)
    ) {
      return;
    }
    const nextDraft = {
      ...consumableFilterDraft,
      trackingMode: "CONSUMABLE",
      locationId: String(selectedWarehouseLocationId),
    };
    setConsumableFilterDraft(nextDraft);
  }, [
    consumableFilterDraft,
    consumableWorkspace,
    isConsumableTab,
    selectedWarehouseLocationId,
  ]);

  useEffect(() => {
    if (!isConsumableMode(initialTrackingMode)) return;
    setConsumableWorkspace((previous) => {
      const nextWorkspace = normalizeConsumableWorkspace(
        initialConsumableWorkspace,
        user?.role === "Admin",
      );
      return previous === nextWorkspace ? previous : nextWorkspace;
    });
  }, [initialConsumableWorkspace, initialTrackingMode, user?.role]);

  useEffect(() => {
    if (!isConsumableTab || !isAdmin) return;
    void loadPendingConsumableRequests();
  }, [isAdmin, isConsumableTab]);

  useEffect(() => {
    if (!isConsumableTab) return;
    void loadExpiredLots();
  }, [isConsumableTab]);

  useEffect(() => {
    if (!isConsumableTab) return;
    void loadDisposalRequests();
  }, [isConsumableTab]);

  useEffect(() => {
    if (!isConsumableTab || !isAdmin) return;
    void loadPendingDisposalRequests();
  }, [isAdmin, isConsumableTab]);

  const resetForm = () => {
    setSelectedQaCode(null);
    setFormErrors({});
    setForm({
      trackingMode: activeTrackingMode,
      name: "",
      categoryId: "",
      locationId:
        activeTrackingMode === "CONSUMABLE" &&
        defaultConsumableWarehouseLocation?.id
          ? String(defaultConsumableWarehouseLocation.id)
          : "",
      technicalStatus: "Hoạt động tốt",
      usageStatus: "Tại vị trí gốc",
      supplierId: "",
      purchasePrice: "",
      purchaseDate: "",
      warrantyExpirationDate: "",
      expiryTrackingEnabled: false,
      expirationDate: "",
      quantityOnHand: "",
      quantityOnHandUnit: "RETAIL",
      minimumStock: "",
      minimumStockUnit: "RETAIL",
      retailUnit: "",
      wholesaleUnit: "",
      wholesaleToRetailFactor: "",
      specEntries: [],
    });
  };

  const openCreateModal = () => {
    setFormMode("create");
    setQrImage("");
    resetForm();
    setShowFormModal(true);
  };

  const handleSwitchTab = async (nextTab) => {
    if (nextTab === activeTrackingMode) return;
    const nextSortState = getDefaultSortState(nextTab);
    const nextFilters = {
      name: "",
      status: "",
      technicalStatus: "",
      usageStatus: "",
      trackingMode: nextTab,
      categoryId: "",
      locationId: "",
      categoryKeyword: "",
      locationKeyword: "",
    };
    setActiveTab(nextTab);
    setFilters(nextFilters);
    if (nextTab === "CONSUMABLE") {
      setConsumableFilterDraft(nextFilters);
    } else {
      setItemizedFilterDraft(nextFilters);
    }
    setSortState(nextSortState);
    setQrImage("");
    setConsumableWorkspace(
      normalizeConsumableWorkspace(initialConsumableWorkspace, isAdmin),
    );
    if (showFormModal) {
      setShowFormModal(false);
      resetForm();
    }
    if (nextTab === "CONSUMABLE" && isAdmin) {
      await loadPendingConsumableRequests();
    }
  };

  const resetSupplierForm = () => {
    setSupplierForm({ name: "", address: "", phoneNumber: "" });
    setSupplierFormErrors({});
  };

  const closeSupplierCreateModal = () => {
    setShowSupplierCreateModal(false);
    resetSupplierForm();
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  const closeIssueModal = () => {
    setShowIssueModal(false);
    setSelectedIssueAsset(null);
    setIssueHistory([]);
    setIssueLocationStocks([]);
    setIssueForm({
      issuedToLocationId: "",
      sourceWarehouseLocationId: "",
      quantity: "",
      note: "",
    });
  };

  const closeReceiveModal = () => {
    setShowReceiveModal(false);
    setSelectedReceiveAsset(null);
    setReceiveForm({
      quantity: "",
      quantityUnit: "WHOLESALE",
      unitPrice: "",
      supplierId: "",
      warehouseLocationId: "",
      lotCode: "",
      receivedDate: "",
      expirationDate: "",
      note: "",
    });
  };

  const closeConsumableRequestModal = () => {
    setShowConsumableRequestModal(false);
    setSelectedRequestAssetQaCode("");
    setConsumableRequestLocationId("");
    setConsumableRequestForm({
      assetQaCode: "",
      sourceWarehouseLocationId: "",
      quantityRequested: "",
      reason: "",
    });
  };

  const closeConsumableDecisionModal = () => {
    setShowConsumableDecisionModal(false);
    setSelectedConsumableRequest(null);
    setConsumableDecisionAction("APPROVE");
    setConsumableDecisionSourceWarehouseLocationId("");
    setConsumableDecisionNote("");
  };

  const closeDisposalRequestModal = () => {
    setShowDisposalRequestModal(false);
    setSelectedExpiredLot(null);
    setDisposalRequestForm({
      reason: "Do hết hạn sử dụng.",
      items: [],
    });
  };

  const closeDisposalDecisionModal = () => {
    setShowDisposalDecisionModal(false);
    setSelectedDisposalRequest(null);
    setDisposalDecisionAction("APPROVE");
    setDisposalDecisionNote("");
  };

  const closeDisposalHistoryDetailModal = () => {
    setSelectedDisposalHistoryRequest(null);
  };

  const closeStockAdjustModal = () => {
    setShowStockAdjustModal(false);
    setSelectedStockRecord(null);
    setStockAdjustForm({
      quantityRemaining: "",
      note: "",
    });
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const response = await axiosClient.get("/api/reports/export-assets", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "danh-sach-thiet-bi.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Đang tải báo cáo Excel.");
    } catch (error) {
      const message =
        error?.response?.data?.message || "Tải báo cáo Excel thất bại.";
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  const handleImportTemplate = async () => {
    try {
      const response = await axiosClient.get("/api/assets/import/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "mau-nhap-tai-san.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Không tải được file mẫu.");
    }
  };

  const handleImportPreview = async (file) => {
    setImportPreviewing(true);
    setImportPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axiosClient.post(
        "/api/assets/import/preview",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setImportPreview(response.data);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Không thể đọc file. Hãy kiểm tra định dạng.",
      );
    } finally {
      setImportPreviewing(false);
    }
  };

  const handleImportCommit = async () => {
    if (!importFile) return;
    setImportCommitting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const response = await axiosClient.post(
        "/api/assets/import/commit",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      const { imported, skipped } = response.data;
      toast.success(
        `Đã nhập thành công ${imported} tài sản. ${skipped > 0 ? `Bỏ qua ${skipped} dòng lỗi.` : ""}`,
      );
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      void loadAssets();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Nhập tài sản thất bại.");
    } finally {
      setImportCommitting(false);
    }
  };

  const handleCreateAsset = async () => {
    const nextErrors = validateAssetForm(form, {
      specEntryLabel: isConsumableMode(form.trackingMode)
        ? "thông số"
        : "đặc tính kỹ thuật",
    });
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0]);
      return;
    }
    setSubmitting(true);
    try {
      const response = await axiosClient.post("/api/assets", {
        trackingMode: form.trackingMode,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(form.locationId),
        status: isConsumableMode(form.trackingMode)
          ? "Còn hàng"
          : itemizedStatusOptions[0].value,
        technicalStatus: isConsumableMode(form.trackingMode)
          ? null
          : form.technicalStatus,
        usageStatus: isConsumableMode(form.trackingMode)
          ? null
          : form.usageStatus,
        specs: stringifySpecs(form.specEntries),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpirationDate: isConsumableMode(form.trackingMode)
          ? null
          : form.warrantyExpirationDate || null,
        expiryTrackingEnabled: isConsumableMode(form.trackingMode)
          ? Boolean(form.expiryTrackingEnabled)
          : null,
        expirationDate:
          isConsumableMode(form.trackingMode) && form.expiryTrackingEnabled
            ? form.expirationDate || null
            : null,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        quantityOnHand: isConsumableMode(form.trackingMode)
          ? Number(form.quantityOnHand)
          : null,
        quantityOnHandUnit: isConsumableMode(form.trackingMode)
          ? form.quantityOnHandUnit
          : null,
        minimumStock: isConsumableMode(form.trackingMode)
          ? Number(form.minimumStock)
          : null,
        minimumStockUnit: isConsumableMode(form.trackingMode)
          ? form.minimumStockUnit
          : null,
        unit: isConsumableMode(form.trackingMode)
          ? form.retailUnit.trim()
          : null,
        retailUnit: isConsumableMode(form.trackingMode)
          ? form.retailUnit.trim()
          : null,
        wholesaleUnit: isConsumableMode(form.trackingMode)
          ? form.wholesaleUnit.trim()
          : null,
        wholesaleToRetailFactor: isConsumableMode(form.trackingMode)
          ? Number(form.wholesaleToRetailFactor)
          : null,
      });
      if (response.data?.qrCodeBase64) {
        setQrImage(`data:image/png;base64,${response.data.qrCodeBase64}`);
      } else {
        setQrImage("");
      }
      toast.success(
        `${isConsumableMode(form.trackingMode) ? "Thêm vật tư" : "Thêm thiết bị"} thành công. Mã mới: ${response.data?.qaCode || "đã tự sinh"}.`,
      );
      if (response.data?.qaCode) {
        setAssetDetailsByQaCode((prev) => ({
          ...prev,
          [response.data.qaCode]: response.data,
        }));
      }
      closeFormModal();
      await loadAssets(pageInfo.page);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Thêm thiết bị thất bại.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAsset = async () => {
    if (!selectedQaCode) return;
    const nextErrors = validateAssetForm(form, {
      specEntryLabel: isConsumableMode(form.trackingMode)
        ? "thông số"
        : "đặc tính kỹ thuật",
    });
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0]);
      return;
    }
    setSubmitting(true);
    try {
      const response = await axiosClient.put(`/api/assets/${selectedQaCode}`, {
        trackingMode: form.trackingMode,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        locationId: Number(form.locationId),
        technicalStatus: isConsumableMode(form.trackingMode)
          ? null
          : form.technicalStatus,
        usageStatus: isConsumableMode(form.trackingMode)
          ? null
          : form.usageStatus,
        specs: stringifySpecs(form.specEntries),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate || null,
        warrantyExpirationDate: isConsumableMode(form.trackingMode)
          ? null
          : form.warrantyExpirationDate || null,
        expiryTrackingEnabled: isConsumableMode(form.trackingMode)
          ? Boolean(form.expiryTrackingEnabled)
          : null,
        expirationDate:
          isConsumableMode(form.trackingMode) && form.expiryTrackingEnabled
            ? form.expirationDate || null
            : null,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        quantityOnHand: isConsumableMode(form.trackingMode)
          ? Number(form.quantityOnHand)
          : null,
        quantityOnHandUnit: isConsumableMode(form.trackingMode)
          ? form.quantityOnHandUnit
          : null,
        minimumStock: isConsumableMode(form.trackingMode)
          ? Number(form.minimumStock)
          : null,
        minimumStockUnit: isConsumableMode(form.trackingMode)
          ? form.minimumStockUnit
          : null,
        unit: isConsumableMode(form.trackingMode)
          ? form.retailUnit.trim()
          : null,
        retailUnit: isConsumableMode(form.trackingMode)
          ? form.retailUnit.trim()
          : null,
        wholesaleUnit: isConsumableMode(form.trackingMode)
          ? form.wholesaleUnit.trim()
          : null,
        wholesaleToRetailFactor: isConsumableMode(form.trackingMode)
          ? Number(form.wholesaleToRetailFactor)
          : null,
      });
      toast.success(
        `${isConsumableMode(form.trackingMode) ? "Cập nhật vật tư" : "Cập nhật thiết bị"} thành công.`,
      );
      if (response.data?.qaCode) {
        setAssetDetailsByQaCode((prev) => ({
          ...prev,
          [response.data.qaCode]: response.data,
        }));
      }
      closeFormModal();
      await loadAssets(pageInfo.page);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Cập nhật thiết bị thất bại.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (qaCode = selectedQaCode) => {
    if (!qaCode) return;
    setConfirmDialog({
      open: true,
      title: "Xóa thiết bị",
      message: `Bạn có chắc muốn xóa thiết bị ${qaCode}?`,
      confirmLabel: "Xóa",
      cancelLabel: "Hủy",
      tone: "danger",
      busy: false,
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await axiosClient.delete(`/api/assets/${qaCode}`);
          toast.success("Xóa thiết bị thành công.");
          if (qaCode === selectedQaCode) {
            resetForm();
          }
          setAssetDetailsByQaCode((prev) => {
            const next = { ...prev };
            delete next[qaCode];
            return next;
          });
          await loadAssets(pageInfo.page);
          return true;
        } catch (error) {
          const message =
            error?.response?.data?.message || "Xóa thiết bị thất bại.";
          toast.error(message);
          return false;
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((previous) =>
      previous.busy ? previous : createDefaultConfirmDialog(),
    );
  };

  const handleConfirmDialogAccept = async () => {
    if (!confirmDialog.onConfirm || confirmDialog.busy) return;
    setConfirmDialog((previous) => ({ ...previous, busy: true }));
    const shouldClose = await confirmDialog.onConfirm();
    if (shouldClose === false) {
      setConfirmDialog((previous) => ({ ...previous, busy: false }));
      return;
    }
    setConfirmDialog(createDefaultConfirmDialog());
  };

  const handleSelectAsset = async (asset) => {
    try {
      const detail = await fetchAssetDetail(asset.qaCode);
      const categoryTemplates = await getCategorySpecTemplates(
        detail.categoryId || asset.categoryId,
      );
      setSelectedQaCode(asset.qaCode);
      setQrImage("");
      setForm({
        trackingMode: detail.trackingMode || "ITEMIZED",
        name: detail.name || asset.name,
        categoryId: String(detail.categoryId || asset.categoryId),
        locationId: String(
          detail.homeLocationId ||
            detail.locationId ||
            asset.homeLocationId ||
            asset.locationId ||
            "",
        ),
        technicalStatus:
          detail.technicalStatus || asset.technicalStatus || "Hoạt động tốt",
        usageStatus:
          detail.usageStatus || asset.usageStatus || "Tại vị trí gốc",
        supplierId: detail.supplierId ? String(detail.supplierId) : "",
        purchasePrice: detail.purchasePrice ?? asset.purchasePrice ?? "",
        purchaseDate: detail.purchaseDate || asset.purchaseDate || "",
        warrantyExpirationDate:
          detail.warrantyExpirationDate || asset.warrantyExpirationDate || "",
        expiryTrackingEnabled: Boolean(
          detail.expiryTrackingEnabled ?? asset.expiryTrackingEnabled,
        ),
        expirationDate: detail.expirationDate || asset.expirationDate || "",
        quantityOnHand: detail.quantityOnHand ?? "",
        quantityOnHandUnit: "RETAIL",
        minimumStock: detail.minimumStock ?? "",
        minimumStockUnit: "RETAIL",
        retailUnit: detail.retailUnit || detail.unit || "",
        wholesaleUnit:
          detail.wholesaleUnit || detail.retailUnit || detail.unit || "",
        wholesaleToRetailFactor: detail.wholesaleToRetailFactor ?? 1,
        specEntries: withSpecEntryKeys(
          parseSpecsToEntries(detail.specs, categoryTemplates),
        ),
      });
      setFormMode("update");
      setShowFormModal(true);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        `Không thể tải ${getSpecTemplateLabelByTrackingMode(asset?.trackingMode).toLowerCase()} của loại đã chọn.`;
      toast.error(message);
    }
  };

  const handleCategoryChange = async (categoryId) => {
    try {
      const categoryTemplates = await getCategorySpecTemplates(categoryId);
      setForm((prev) => ({
        ...prev,
        categoryId,
        specEntries: withSpecEntryKeys(
          mergeSpecEntries(categoryTemplates, prev.specEntries),
        ),
      }));
      setFormErrors((prev) => ({ ...prev, categoryId: "", specEntries: "" }));
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        `Không thể tải ${getSpecTemplateLabelByTrackingMode(form.trackingMode).toLowerCase()} của loại đã chọn.`;
      toast.error(message);
    }
  };

  const updateSpecEntry = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      specEntries: prev.specEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    }));
    setFormErrors((prev) => ({ ...prev, specEntries: "" }));
  };

  const addCustomSpecEntry = () => {
    setForm((prev) => ({
      ...prev,
      specEntries: [
        ...prev.specEntries,
        createSpecEntryWithKey({ name: "", value: "", isCustom: true }),
      ],
    }));
    setFormErrors((prev) => ({ ...prev, specEntries: "" }));
  };

  const removeSpecEntry = (index) => {
    setForm((prev) => ({
      ...prev,
      specEntries: prev.specEntries.filter(
        (_, entryIndex) => entryIndex !== index,
      ),
    }));
    setFormErrors((prev) => ({ ...prev, specEntries: "" }));
  };

  const handleOpenSpecsModal = async (asset) => {
    try {
      const detail = await fetchAssetDetail(asset.qaCode);
      setSelectedSpecsAsset(detail);
      setShowSpecsModal(true);
      setOpenActionMenuQaCode(null);
    } catch (error) {
      const itemLabel = isConsumableMode(asset?.trackingMode)
        ? "thông số của vật tư"
        : "đặc tính kỹ thuật của thiết bị";
      const message =
        error?.response?.data?.message || `Không thể tải ${itemLabel}.`;
      toast.error(message);
    }
  };

  const handleCreateSupplierInline = async () => {
    const nextErrors = validateSupplierForm(supplierForm);
    setSupplierFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0]);
      return;
    }

    setCreatingSupplier(true);
    try {
      const response = await axiosClient.post("/api/suppliers", {
        name: supplierForm.name.trim(),
        address: supplierForm.address.trim(),
        phoneNumber: supplierForm.phoneNumber.trim(),
      });
      const createdSupplier = response.data;
      setSuppliers((prev) =>
        [...prev, createdSupplier].sort((a, b) =>
          getSupplierLabel(a).localeCompare(getSupplierLabel(b), "vi"),
        ),
      );
      setForm((prev) => ({ ...prev, supplierId: String(createdSupplier.id) }));
      setFormErrors((prev) => ({ ...prev, supplierId: "" }));
      toast.success("Đã thêm nhà cung cấp mới.");
      closeSupplierCreateModal();
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể thêm nhà cung cấp mới.";
      toast.error(message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  const handleResetFilters = () => {
    const reset = {
      name: "",
      status: "",
      technicalStatus: "",
      usageStatus: "",
      trackingMode: activeTrackingMode,
      categoryId: "",
      locationId: "",
      categoryKeyword: "",
      locationKeyword: "",
    };
    setFilters(reset);
    setItemizedFilterDraft(reset);
    setConsumableFilterDraft(reset);
  };

  const handleOpenIssueModal = async (
    assetOrQaCode,
    { locationId = "" } = {},
  ) => {
    const qaCode =
      typeof assetOrQaCode === "string" ? assetOrQaCode : assetOrQaCode?.qaCode;
    if (!qaCode) return;
    setIssueHistoryLoading(true);
    try {
      const [detail, historyResponse, locationStocks] = await Promise.all([
        fetchAssetDetail(qaCode),
        axiosClient.get(`/api/assets/${qaCode}/issues`),
        fetchConsumableLocationStocks(qaCode),
      ]);
      const initialWarehouseOptions = buildWarehouseOptionsFromAssetDetail(
        detail,
        warehouseLocations,
      );
      setSelectedIssueAsset(detail);
      setIssueHistory(historyResponse.data || []);
      setIssueLocationStocks(locationStocks || []);
      setIssueForm({
        issuedToLocationId: locationId ? String(locationId) : "",
        sourceWarehouseLocationId: String(
          detail?.homeLocationId || initialWarehouseOptions[0]?.id || "",
        ),
        quantity: "",
        note: "",
      });
      setShowIssueModal(true);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Không thể tải dữ liệu cấp phát vật tư.";
      toast.error(message);
    } finally {
      setIssueHistoryLoading(false);
    }
  };

  const handleOpenIssueModalFromRoomStock = (stock) => {
    if (!stock?.assetQaCode) return;
    if (!stock?.locationId) {
      toast.error("Không xác định được phòng cần cấp phát.");
      return;
    }
    void handleOpenIssueModal(stock.assetQaCode, {
      locationId: stock.locationId,
    });
  };

  const handleOpenReceiveModal = async (asset) => {
    try {
      const detail = await fetchAssetDetail(asset.qaCode);
      setSelectedReceiveAsset(detail);
      setReceiveForm({
        quantity: "",
        quantityUnit:
          Number(detail?.wholesaleToRetailFactor ?? 1) > 1
            ? "WHOLESALE"
            : "RETAIL",
        unitPrice: detail?.purchasePrice ? String(detail.purchasePrice) : "",
        supplierId: detail?.supplierId ? String(detail.supplierId) : "",
        warehouseLocationId: String(
          detail?.homeLocationId ||
            defaultConsumableWarehouseLocation?.id ||
            "",
        ),
        lotCode: "",
        receivedDate: new Date().toISOString().slice(0, 10),
        expirationDate: "",
        note: "",
      });
      setShowReceiveModal(true);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tải dữ liệu nhập hàng.";
      toast.error(message);
    }
  };

  const handleOpenConsumableRequestModal = async (
    assetQaCode = "",
    locationId = "",
  ) => {
    const resolvedAssetQaCode =
      assetQaCode ||
      selectedRequestAssetQaCode ||
      consumableRequestAssetOptions[0]?.qaCode ||
      "";
    const resolvedLocationId =
      locationId ||
      (String(selectedRoomId) !== ALL_ROOMS_ID ? selectedRoomId : "");
    const detail = resolvedAssetQaCode
      ? await fetchAssetDetail(resolvedAssetQaCode).catch(() => null)
      : null;
    const initialWarehouseOptions = buildWarehouseOptionsFromAssetDetail(
      detail,
      warehouseLocations,
    );
    setSelectedRequestAssetQaCode(resolvedAssetQaCode);
    setConsumableRequestLocationId(
      resolvedLocationId ? String(resolvedLocationId) : "",
    );
    setConsumableRequestForm({
      assetQaCode: resolvedAssetQaCode,
      sourceWarehouseLocationId: String(
        detail?.homeLocationId || initialWarehouseOptions[0]?.id || "",
      ),
      quantityRequested: "",
      reason: "",
    });
    setShowConsumableRequestModal(true);
  };

  const handleOpenConsumableDecisionModal = async (request, action) => {
    const detail = request?.assetQaCode
      ? await fetchAssetDetail(request.assetQaCode).catch(() => null)
      : null;
    const initialWarehouseOptions = buildWarehouseOptionsFromAssetDetail(
      detail,
      warehouseLocations,
    );
    setSelectedConsumableRequest(request);
    setConsumableDecisionAction(action);
    setConsumableDecisionSourceWarehouseLocationId(
      String(
        request?.sourceWarehouseLocationId ||
          detail?.homeLocationId ||
          initialWarehouseOptions[0]?.id ||
          "",
      ),
    );
    setConsumableDecisionNote(
      action === "REJECT" ? "" : request?.decisionNote || "",
    );
    setShowConsumableDecisionModal(true);
  };

  const handleOpenDisposalRequestModal = (lot) => {
    const relatedLots = expiredLots.filter(
      (item) => item.assetQaCode === lot?.assetQaCode,
    );
    setSelectedExpiredLot(lot);
    setDisposalRequestForm({
      reason: "Do hết hạn sử dụng.",
      items: relatedLots.map((item) => ({
        receiptLotId: item.lotId,
        lotCode: item.lotCode || `Lô #${item.lotId}`,
        expirationDate: item.expirationDate,
        receivedDate: item.receivedDate,
        quantityRemaining: item.quantityRemaining,
        unit: item.unit,
        selected: item.lotId === lot?.lotId,
        quantityRequested:
          item.lotId === lot?.lotId ? String(item.quantityRemaining || "") : "",
      })),
    });
    setShowDisposalRequestModal(true);
  };

  const handleOpenDisposalDecisionModal = (request, action) => {
    setSelectedDisposalRequest(request);
    setDisposalDecisionAction(action);
    setDisposalDecisionNote(
      action === "REJECT" ? "" : request?.decisionNote || "",
    );
    setShowDisposalDecisionModal(true);
  };

  const handleReceiveConsumable = async () => {
    if (!selectedReceiveAsset?.qaCode) return;
    const quantity = Number(receiveForm.quantity);
    const unitPrice = Number(receiveForm.unitPrice);
    const quantityUnitLabel = getConsumableQuantityInputUnit(
      selectedReceiveAsset,
      receiveForm.quantityUnit,
    );
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error(
        `Số lượng nhập theo ${quantityUnitLabel} phải là số nguyên lớn hơn 0.`,
      );
      return;
    }
    if (Number.isNaN(unitPrice) || unitPrice <= 0) {
      toast.error("Đơn giá nhập phải lớn hơn 0.");
      return;
    }
    if (!receiveForm.supplierId) {
      toast.error("Vui lòng chọn nhà cung cấp cho lô nhập.");
      return;
    }
    if (!receiveForm.warehouseLocationId) {
      toast.error("Vui lòng chọn kho nhập cho lô hàng này.");
      return;
    }
    if (!receiveForm.receivedDate) {
      toast.error("Vui lòng chọn ngày nhập lô.");
      return;
    }
    if (
      selectedReceiveAsset.expiryTrackingEnabled &&
      !receiveForm.expirationDate
    ) {
      toast.error("Vui lòng chọn hạn sử dụng cho lô nhập này.");
      return;
    }
    if (
      receiveForm.expirationDate &&
      new Date(receiveForm.expirationDate) < new Date(receiveForm.receivedDate)
    ) {
      toast.error("Hạn sử dụng phải sau hoặc bằng ngày nhập lô.");
      return;
    }
    setReceiveSubmitting(true);
    try {
      const response = await axiosClient.post(
        `/api/assets/${selectedReceiveAsset.qaCode}/receipts`,
        {
          quantity,
          quantityUnit: receiveForm.quantityUnit,
          unitPrice,
          supplierId: Number(receiveForm.supplierId),
          warehouseLocationId: Number(receiveForm.warehouseLocationId),
          lotCode: receiveForm.lotCode.trim() || null,
          receivedDate: receiveForm.receivedDate,
          expirationDate: selectedReceiveAsset.expiryTrackingEnabled
            ? receiveForm.expirationDate || null
            : null,
          note: receiveForm.note.trim() || null,
        },
      );
      const updatedDetail = response.data || {};
      setAssetDetailsByQaCode((prev) => ({
        ...prev,
        [selectedReceiveAsset.qaCode]: updatedDetail,
      }));
      toast.success("Nhập hàng thành công.");
      await loadAssets(pageInfo.page);
      closeReceiveModal();
    } catch (error) {
      const message = error?.response?.data?.message || "Nhập hàng thất bại.";
      toast.error(message);
    } finally {
      setReceiveSubmitting(false);
    }
  };

  const handleCreateConsumableRequest = async () => {
    const requestLocationId =
      consumableRequestLocationId ||
      (String(selectedRoomId) !== ALL_ROOMS_ID ? selectedRoomId : "");
    if (!requestLocationId) {
      toast.error("Vui lòng chọn phòng cần yêu cầu cấp phát.");
      return;
    }
    const assetQaCode =
      consumableRequestForm.assetQaCode || selectedRequestAssetQaCode;
    const quantityRequested = Number(consumableRequestForm.quantityRequested);
    if (!assetQaCode) {
      toast.error("Vui lòng chọn vật tư cần cấp phát.");
      return;
    }
    if (!Number.isInteger(quantityRequested) || quantityRequested <= 0) {
      toast.error("Số lượng yêu cầu phải là số nguyên lớn hơn 0.");
      return;
    }
    if (!consumableRequestForm.reason.trim()) {
      toast.error("Vui lòng nhập lý do cần cấp phát.");
      return;
    }
    if (!consumableRequestForm.sourceWarehouseLocationId) {
      toast.error("Vui lòng chọn kho xuất cho phiếu yêu cầu.");
      return;
    }
    setConsumableRequestSubmitting(true);
    try {
      await axiosClient.post(
        `/api/assets/locations/${requestLocationId}/consumable-requests`,
        {
          assetQaCode,
          sourceWarehouseLocationId: Number(
            consumableRequestForm.sourceWarehouseLocationId,
          ),
          quantityRequested,
          reason: consumableRequestForm.reason.trim(),
        },
      );
      toast.success("Đã gửi yêu cầu cấp phát.");
      await refreshRoomOverview(selectedRoomId);
      if (isAdmin) {
        await loadPendingConsumableRequests();
      }
      closeConsumableRequestModal();
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tạo yêu cầu cấp phát.";
      toast.error(message);
    } finally {
      setConsumableRequestSubmitting(false);
    }
  };

  const handleSubmitConsumableDecision = async () => {
    if (!selectedConsumableRequest?.id) return;
    if (
      consumableDecisionAction === "REJECT" &&
      !consumableDecisionNote.trim()
    ) {
      toast.error("Vui lòng nhập lý do từ chối phiếu yêu cầu.");
      return;
    }
    if (
      consumableDecisionAction === "APPROVE" &&
      !consumableDecisionSourceWarehouseLocationId
    ) {
      toast.error("Vui lòng chọn kho xuất trước khi duyệt cấp phát.");
      return;
    }
    setConsumableDecisionSubmitting(true);
    try {
      const endpoint =
        consumableDecisionAction === "APPROVE" ? "approve" : "reject";
      await axiosClient.post(
        `/api/assets/consumable-requests/${selectedConsumableRequest.id}/${endpoint}`,
        {
          sourceWarehouseLocationId:
            consumableDecisionAction === "APPROVE"
              ? Number(consumableDecisionSourceWarehouseLocationId)
              : null,
          note: consumableDecisionNote.trim(),
        },
      );
      toast.success(
        consumableDecisionAction === "APPROVE"
          ? "Đã duyệt cấp phát phiếu yêu cầu."
          : "Đã từ chối phiếu yêu cầu.",
      );
      await Promise.all([
        loadAssets(pageInfo.page),
        loadPendingConsumableRequests(),
        selectedRoomId
          ? refreshRoomOverview(selectedRoomId)
          : Promise.resolve(),
      ]);
      closeConsumableDecisionModal();
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể xử lý phiếu yêu cầu.";
      toast.error(message);
    } finally {
      setConsumableDecisionSubmitting(false);
    }
  };

  const handleCreateDisposalRequest = async () => {
    if (!selectedExpiredLot?.assetQaCode) return;
    if (!disposalRequestForm.reason.trim()) {
      toast.error("Vui lòng nhập lý do tiêu huỷ.");
      return;
    }
    const selectedItems = (disposalRequestForm.items || [])
      .filter((item) => item.selected)
      .map((item) => ({
        receiptLotId: item.receiptLotId,
        quantityRequested: Number(item.quantityRequested),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.quantityRequested) &&
          item.quantityRequested > 0,
      );
    if (selectedItems.length === 0) {
      toast.error(
        "Vui lòng chọn ít nhất một lô và nhập số lượng tiêu huỷ hợp lệ.",
      );
      return;
    }
    setDisposalRequestSubmitting(true);
    try {
      await axiosClient.post("/api/assets/disposal-requests", {
        reason: disposalRequestForm.reason.trim(),
        items: selectedItems,
      });
      toast.success("Đã tạo yêu cầu tiêu huỷ.");
      await Promise.all([
        loadExpiredLots(),
        loadAssets(pageInfo.page),
        loadDisposalRequests(),
        isAdmin ? loadPendingDisposalRequests() : Promise.resolve(),
      ]);
      closeDisposalRequestModal();
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tạo yêu cầu tiêu huỷ.";
      toast.error(message);
    } finally {
      setDisposalRequestSubmitting(false);
    }
  };

  const handleDownloadDisposalDocument = async (requestId) => {
    if (!requestId) return;
    setDownloadingDisposalRequestId(requestId);
    try {
      const response = await axiosClient.get(
        `/api/reports/export-expired-disposal/${requestId}`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `bien-ban-huy-hang-hoa-het-han-${requestId}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể tải biên bản tiêu huỷ.";
      toast.error(message);
    } finally {
      setDownloadingDisposalRequestId(null);
    }
  };

  const handleSubmitDisposalDecision = async () => {
    if (!selectedDisposalRequest?.id) return;
    if (disposalDecisionAction === "REJECT" && !disposalDecisionNote.trim()) {
      toast.error("Vui lòng nhập lý do từ chối yêu cầu tiêu huỷ.");
      return;
    }
    setDisposalDecisionSubmitting(true);
    try {
      const endpoint =
        disposalDecisionAction === "APPROVE" ? "approve" : "reject";
      const response = await axiosClient.post(
        `/api/assets/disposal-requests/${selectedDisposalRequest.id}/${endpoint}`,
        {
          note: disposalDecisionNote.trim(),
        },
      );
      toast.success(
        disposalDecisionAction === "APPROVE"
          ? "Đã duyệt yêu cầu tiêu huỷ."
          : "Đã từ chối yêu cầu tiêu huỷ.",
      );
      await Promise.all([
        loadAssets(pageInfo.page),
        loadExpiredLots(),
        loadDisposalRequests(),
        loadPendingDisposalRequests(),
      ]);
      closeDisposalDecisionModal();
      if (disposalDecisionAction === "APPROVE") {
        await handleDownloadDisposalDocument(
          response.data?.id || selectedDisposalRequest.id,
        );
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể xử lý yêu cầu tiêu huỷ.";
      toast.error(message);
    } finally {
      setDisposalDecisionSubmitting(false);
    }
  };

  const handleIssueConsumable = async () => {
    if (!selectedIssueAsset?.qaCode) return;
    const quantity = Number(issueForm.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Số lượng cấp phát phải lớn hơn 0.");
      return;
    }
    if (!issueForm.issuedToLocationId) {
      toast.error("Vui lòng chọn phòng nhận.");
      return;
    }
    if (!issueForm.sourceWarehouseLocationId) {
      toast.error("Vui lòng chọn kho xuất.");
      return;
    }
    setIssueSubmitting(true);
    try {
      await axiosClient.post(
        `/api/assets/${selectedIssueAsset.qaCode}/issues`,
        {
          issuedToLocationId: Number(issueForm.issuedToLocationId),
          sourceWarehouseLocationId: Number(
            issueForm.sourceWarehouseLocationId,
          ),
          quantity,
          note: issueForm.note.trim(),
        },
      );
      const [detailResponse, historyResponse, locationStocks] =
        await Promise.all([
          axiosClient.get(`/api/assets/${selectedIssueAsset.qaCode}`),
          axiosClient.get(`/api/assets/${selectedIssueAsset.qaCode}/issues`),
          fetchConsumableLocationStocks(selectedIssueAsset.qaCode),
        ]);
      const updatedDetail = detailResponse.data || {};
      setSelectedIssueAsset(updatedDetail);
      setIssueHistory(historyResponse.data || []);
      setIssueLocationStocks(locationStocks || []);
      setAssetDetailsByQaCode((prev) => ({
        ...prev,
        [selectedIssueAsset.qaCode]: updatedDetail,
      }));
      setIssueForm({
        issuedToLocationId: "",
        sourceWarehouseLocationId: "",
        quantity: "",
        note: "",
      });
      toast.success("Cấp phát vật phẩm thành công.");
      await loadAssets(pageInfo.page);
      if (selectedRoomId) {
        await refreshRoomOverview(selectedRoomId);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || "Cấp phát vật phẩm thất bại.";
      toast.error(message);
    } finally {
      setIssueSubmitting(false);
    }
  };

  const handleOpenStockAdjustModal = (stock) => {
    setSelectedStockRecord(stock);
    setStockAdjustForm({
      quantityRemaining: String(stock?.quantityRemaining ?? 0),
      note: stock?.lastNote || "",
    });
    setShowStockAdjustModal(true);
  };

  const handleUpdateStockRemaining = async () => {
    if (!selectedStockRecord?.assetQaCode || !selectedStockRecord?.locationId)
      return;
    const quantityRemaining = Number(stockAdjustForm.quantityRemaining);
    if (!Number.isInteger(quantityRemaining) || quantityRemaining < 0) {
      toast.error("Số lượng còn lại phải là số nguyên từ 0 trở lên.");
      return;
    }
    setStockAdjustSubmitting(true);
    try {
      await axiosClient.put(
        `/api/assets/${selectedStockRecord.assetQaCode}/location-stocks/${selectedStockRecord.locationId}`,
        {
          quantityRemaining,
          note: stockAdjustForm.note.trim(),
        },
      );

      if (selectedIssueAsset?.qaCode === selectedStockRecord.assetQaCode) {
        const latestStocks = await fetchConsumableLocationStocks(
          selectedStockRecord.assetQaCode,
        );
        setIssueLocationStocks(latestStocks || []);
      }
      if (selectedRoomId) {
        await refreshRoomOverview(selectedRoomId);
      }
      toast.success("Đã cập nhật số lượng còn lại tại phòng.");
      closeStockAdjustModal();
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Không thể cập nhật số lượng còn lại.";
      toast.error(message);
    } finally {
      setStockAdjustSubmitting(false);
    }
  };

  const fetchQrDataUrl = async (qaCode) => {
    let qrCodeBase64 = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await axiosClient.get(`/api/assets/${qaCode}/qr`);
      qrCodeBase64 = String(response.data?.qrCodeBase64 || "").trim();
      if (qrCodeBase64) break;
      if (attempt === 0) {
        await sleep(300);
      }
    }
    if (!qrCodeBase64) {
      throw new Error("Không lấy được mã QR của thiết bị này.");
    }
    return `data:image/png;base64,${qrCodeBase64}`;
  };

  const escapeHtml = (value) =>
    String(value || "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const openQrPrintWindow = ({
    qaCode,
    name,
    qrDataUrl,
    printWindow: existingPrintWindow,
  }) => {
    const printWindow =
      existingPrintWindow || window.open("", "_blank", "width=420,height=560");
    if (!printWindow) {
      toast.error(
        "Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up rồi thử lại.",
      );
      return;
    }

    const safeQaCode = escapeHtml(qaCode);
    const safeName = escapeHtml(name);

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>In mã QR ${safeQaCode}</title>
          <style>
            @page { size: 80mm 100mm; margin: 8mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #111827;
              text-align: center;
            }
            .label {
              display: flex;
              min-height: 80mm;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 8px;
            }
            img {
              width: 58mm;
              height: 58mm;
              object-fit: contain;
            }
            .code {
              font-size: 14px;
              font-weight: 700;
            }
            .name {
              max-width: 64mm;
              font-size: 11px;
              line-height: 1.35;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR ${safeQaCode}" />
            <div class="code">Mã tài sản: ${safeQaCode}</div>
            ${safeName ? `<div class="name">${safeName}</div>` : ""}
          </div>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const openBulkQrPrintWindow = ({ labels, printWindow }) => {
    if (!printWindow) {
      toast.error(
        "Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up rồi thử lại.",
      );
      return;
    }

    const labelHtml = labels
      .map((label) => {
        const safeQaCode = escapeHtml(label.qaCode);
        const safeName = escapeHtml(label.name);
        return `
        <div class="label">
          <img src="${label.qrDataUrl}" alt="QR ${safeQaCode}" />
          <div class="code">${safeQaCode}</div>
          ${safeName ? `<div class="name">${safeName}</div>` : ""}
        </div>
      `;
      })
      .join("");

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>In QR hàng loạt</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #111827;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8mm;
            }
            .label {
              break-inside: avoid;
              min-height: 82mm;
              border: 1px dashed #cbd5e1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 6px;
              padding: 6mm;
              text-align: center;
            }
            img {
              width: 48mm;
              height: 48mm;
              object-fit: contain;
            }
            .code {
              font-size: 13px;
              font-weight: 700;
            }
            .name {
              max-width: 72mm;
              font-size: 10px;
              line-height: 1.35;
            }
          </style>
        </head>
        <body>
          <div class="grid">${labelHtml}</div>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleOpenQrModal = async (asset) => {
    const qaCode = typeof asset === "string" ? asset : asset?.qaCode;
    if (!qaCode) return;
    setQrModalLoading(true);
    try {
      const qrDataUrl = await fetchQrDataUrl(qaCode);
      setQrModalQaCode(qaCode);
      setQrModalAssetName(typeof asset === "string" ? "" : asset?.name || "");
      setQrModalImage(qrDataUrl);
      setShowQrModal(true);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể tải mã QR của thiết bị.";
      toast.error(message);
    } finally {
      setQrModalLoading(false);
    }
  };

  const handlePrintQr = async (asset) => {
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) {
      toast.error(
        "Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up rồi thử lại.",
      );
      return;
    }
    printWindow.document.write(
      '<p style="font-family: Arial, sans-serif; padding: 16px;">Đang tải mã QR...</p>',
    );
    try {
      const qrDataUrl = await fetchQrDataUrl(asset.qaCode);
      openQrPrintWindow({
        qaCode: asset.qaCode,
        name: asset.name,
        qrDataUrl,
        printWindow,
      });
    } catch (error) {
      printWindow.close();
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể in mã QR của thiết bị.";
      toast.error(message);
    }
  };

  const handleToggleQrSelection = (asset) => {
    const qaCode = asset?.qaCode || asset;
    if (!qaCode) return;
    setSelectedQrQaCodes((previous) => {
      const next = new Set(previous);
      if (next.has(qaCode)) {
        next.delete(qaCode);
      } else {
        next.add(qaCode);
      }
      return next;
    });
    setSelectedQrAssetCache((previous) => {
      if (previous[qaCode]) {
        const next = { ...previous };
        delete next[qaCode];
        return next;
      }
      return asset?.qaCode ? { ...previous, [qaCode]: asset } : previous;
    });
  };

  const handleToggleAllPageQrSelection = () => {
    setSelectedQrQaCodes((previous) => {
      const next = new Set(previous);
      if (allPageQrSelected) {
        itemizedAssetsOnPage.forEach((asset) => next.delete(asset.qaCode));
      } else {
        itemizedAssetsOnPage.forEach((asset) => next.add(asset.qaCode));
      }
      return next;
    });
    setSelectedQrAssetCache((previous) => {
      const next = { ...previous };
      if (allPageQrSelected) {
        itemizedAssetsOnPage.forEach((asset) => {
          delete next[asset.qaCode];
        });
      } else {
        itemizedAssetsOnPage.forEach((asset) => {
          next[asset.qaCode] = asset;
        });
      }
      return next;
    });
  };

  const handleCancelQrSelection = () => {
    setQrSelectionMode(false);
    setShowBulkQrPreview(false);
    setSelectedQrQaCodes(new Set());
    setSelectedQrAssetCache({});
  };

  const handleOpenBulkQrPreview = () => {
    if (selectedQrAssets.length === 0) {
      toast.info("Vui lòng chọn ít nhất một tài sản để in QR.");
      return;
    }
    setShowBulkQrPreview(true);
  };

  const handlePrintSelectedQrs = async () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error(
        "Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up rồi thử lại.",
      );
      return;
    }

    setBulkQrPrinting(true);
    printWindow.document.write(
      '<p style="font-family: Arial, sans-serif; padding: 16px;">Đang tải mã QR hàng loạt...</p>',
    );
    try {
      const results = await Promise.allSettled(
        selectedQrAssets.map(async (asset) => ({
          qaCode: asset.qaCode,
          name: asset.name,
          qrDataUrl: await fetchQrDataUrl(asset.qaCode),
        })),
      );
      const labels = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      if (labels.length === 0) {
        printWindow.close();
        toast.error("Không tải được mã QR nào để in.");
        return;
      }

      openBulkQrPrintWindow({ labels, printWindow });
      const failedCount = results.length - labels.length;
      if (failedCount > 0) {
        toast.warning(`Đã bỏ qua ${failedCount} tài sản không tải được QR.`);
      }
      handleCancelQrSelection();
    } catch (error) {
      printWindow.close();
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể in QR hàng loạt.";
      toast.error(message);
    } finally {
      setBulkQrPrinting(false);
    }
  };

  const handlePrintCurrentQr = () => {
    if (!qrModalImage || !qrModalQaCode) return;
    openQrPrintWindow({
      qaCode: qrModalQaCode,
      name: qrModalAssetName,
      qrDataUrl: qrModalImage,
    });
  };

  const handleDownloadCurrentQr = () => {
    if (!qrModalImage || !qrModalQaCode) return;
    const link = document.createElement("a");
    link.href = qrModalImage;
    link.download = `qr-${qrModalQaCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseQrModal = () => {
    setShowQrModal(false);
    setQrModalQaCode("");
    setQrModalAssetName("");
    setQrModalImage("");
  };

  const handleSort = async (key) => {
    const nextSort = {
      key,
      direction:
        sortState.key === key && sortState.direction === "asc" ? "desc" : "asc",
    };
    setSortState(nextSort);
    await loadAssets(0, filters, nextSort);
  };

  const getSortLabel = (key, label) => {
    if (sortState.key !== key) return label;
    return `${label} ${sortState.direction === "asc" ? "▲" : "▼"}`;
  };

  const currentPage = pageInfo.page + 1;
  const totalPages = Math.max(1, pageInfo.totalPages);
  const goToFirstPage = async () => loadAssets(0);
  const goToPrevPage = async () => loadAssets(Math.max(0, pageInfo.page - 1));
  const goToNextPage = async () =>
    loadAssets(Math.min(totalPages - 1, pageInfo.page + 1));
  const goToLastPage = async () => loadAssets(Math.max(0, totalPages - 1));
  const currentConsumableWorkspaceMeta =
    CONSUMABLE_WORKSPACE_META[consumableWorkspace] ||
    CONSUMABLE_WORKSPACE_META.OVERVIEW;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {restrictToConsumable
                ? "Quản lý cấp phát vật tư"
                : isConsumableTab
                  ? currentConsumableWorkspaceMeta.title
                  : "Quản lý tài sản"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {restrictToConsumable
                ? "Không gian làm việc cho vật tư tiêu hao, cấp phát và theo dõi theo phòng."
                : isConsumableTab
                  ? currentConsumableWorkspaceMeta.description
                  : "Tài sản cố định — theo dõi thiết bị, vị trí và trạng thái sử dụng."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {!isConsumableTab ? (
              <>
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  <Plus size={15} />
                  Thêm tài sản
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview(null);
                      setShowImportModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    <Upload size={15} />
                    Nhập Excel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Download size={15} />
                  Xuất Excel
                </button>
              </>
            ) : currentConsumableWorkspaceMeta.allowInventoryActions ? (
              <>
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  <Plus size={15} />
                  Thêm mới
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview(null);
                      setShowImportModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    <Upload size={15} />
                    Nhập Excel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                >
                  <Download size={15} />
                  Xuất Excel
                </button>
              </>
            ) : (
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {currentConsumableWorkspaceMeta.title}
              </div>
            )}
          </div>
        </div>
        {!restrictToConsumable && showTabSwitcher && (
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
            {managementTabs.map((tab) => {
              const active = tab.value === activeTrackingMode;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleSwitchTab(tab.value)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? "bg-white text-fptOrangeDark shadow-sm dark:bg-slate-900 dark:text-orange-300"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
        {qrImage && (
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <img
              src={qrImage}
              alt="QR thiết bị vừa tạo"
              className="h-14 w-14 shrink-0 rounded border border-emerald-200 bg-white dark:border-emerald-500/30"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Tạo thiết bị thành công
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Mã QR đã sẵn sàng. In hoặc tải về để dán lên thiết bị.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (win) {
                    win.document.open();
                    win.document.write(
                      `<!DOCTYPE html><html><head><title>In mã QR</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;}img{width:200px;height:200px;}</style></head><body><img src="${qrImage}" onload="window.print();window.close()"/></body></html>`,
                    );
                    win.document.close();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                <Printer size={13} />
                In QR
              </button>
              <a
                href={qrImage}
                download="qr-thiet-bi.png"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                <Download size={13} />
                Tải PNG
              </a>
              <button
                type="button"
                onClick={() => setQrImage("")}
                className="ml-1 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                title="Đóng"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isConsumableTab ? (
        <div className="space-y-4">
          {consumableWorkspace === "OVERVIEW" ||
          consumableWorkspace === "WAREHOUSES" ? (
            <>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                {consumableWorkspace === "WAREHOUSES" && (
                  <div className="grid gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 lg:grid-cols-[minmax(260px,360px)_1fr]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        Kho đang xem
                      </label>
                      <SearchableSelect
                        value={selectedWarehouseLocationId}
                        onChange={(nextValue) =>
                          setSelectedWarehouseLocationId(
                            String(nextValue || ""),
                          )
                        }
                        options={warehouseLocations}
                        getOptionValue={(location) => location.id}
                        getOptionLabel={(location) => location.roomName}
                        placeholder="Chọn kho vật tư"
                        emptyOptionLabel="Chưa có kho vật tư"
                        inputClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
                      <p className="font-semibold">Tồn kho theo kho lưu trữ</p>
                      <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                        {selectedWarehouseLocation
                          ? `Đang hiển thị vật tư nằm trong kho ${selectedWarehouseLocation.roomName}.`
                          : "Chọn một kho để xem tồn, nhập hàng và thao tác vật tư theo từng kho."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={consumableFilterDraft.name}
                      onChange={(e) =>
                        setConsumableFilterDraft((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Tìm tên hoặc mã vật tư"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {consumableWorkspace !== "WAREHOUSES" && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowConsumableAdvancedFilters((v) => !v)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${showConsumableAdvancedFilters ? "border-fptOrange bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${showConsumableAdvancedFilters ? "rotate-180" : ""}`}
                        />
                        Bộ lọc nâng cao
                      </button>
                    )}
                    {hasActiveConsumableFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </div>
                </div>

                {showConsumableAdvancedFilters &&
                  consumableWorkspace !== "WAREHOUSES" && (
                    <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Loại vật tư
                        </label>
                        <SearchableSelect
                          value={consumableFilterDraft.categoryId}
                          onChange={(nextValue) =>
                            setConsumableFilterDraft((prev) => ({
                              ...prev,
                              categoryId: String(nextValue || ""),
                              categoryKeyword:
                                getCategoryLabel(
                                  categories.find(
                                    (category) =>
                                      String(category.id) ===
                                      String(nextValue || ""),
                                  ),
                                ) || "",
                            }))
                          }
                          options={filteredCategoryOptions}
                          getOptionValue={(category) => category.id}
                          getOptionLabel={(category) =>
                            getCategoryLabel(category)
                          }
                          placeholder="Gõ để tìm loại vật tư"
                          emptyOptionLabel="Tất cả loại"
                          inputClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Kho
                        </label>
                        <SearchableSelect
                          value={consumableFilterDraft.locationId}
                          onChange={(nextValue) =>
                            setConsumableFilterDraft((prev) => ({
                              ...prev,
                              locationId: String(nextValue || ""),
                            }))
                          }
                          options={locations}
                          getOptionValue={(location) => location.id}
                          getOptionLabel={(location) => location.roomName}
                          placeholder="Gõ để tìm kho"
                          emptyOptionLabel="Tất cả kho"
                          inputClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          Trạng thái tồn kho
                        </label>
                        <select
                          value={consumableFilterDraft.status}
                          onChange={(e) =>
                            setConsumableFilterDraft((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">Tất cả trạng thái</option>
                          {consumableStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status === "Còn hàng" ? "Đủ dùng" : "Cần nhập"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {consumableWorkspace === "WAREHOUSES"
                      ? `Tồn kho ${selectedWarehouseLocation?.roomName || ""}`.trim()
                      : "Danh sách vật tư tiêu hao"}
                  </h2>
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    Tổng: {pageInfo.totalItems}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 dark:border-slate-800">
                  <table className="w-full table-fixed divide-y divide-slate-200 text-xs dark:divide-slate-800">
                    <colgroup>
                      <col className="w-[10%]" />
                      <col className="w-[17%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[11%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[132px]" />
                    </colgroup>
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleSort("qaCode")}
                            className="block w-full truncate text-left hover:text-fptOrange"
                          >
                            {getSortLabel("qaCode", "Mã")}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleSort("name")}
                            className="block w-full truncate text-left hover:text-fptOrange"
                          >
                            {getSortLabel("name", "Tên vật tư")}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleSort("category")}
                            className="block w-full truncate text-left hover:text-fptOrange"
                          >
                            {getSortLabel("category", "Loại")}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">
                          Kho
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleSort("quantityOnHand")}
                            className="block w-full truncate text-left hover:text-fptOrange"
                          >
                            {getSortLabel("quantityOnHand", "Tồn / Ngưỡng")}
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                          Thông số
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                          HSD gần nhất
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-400">
                          Giá trị tồn
                        </th>
                        <th className="px-2 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-400">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loading &&
                        Array.from({ length: 6 }).map((_, index) => (
                          <tr
                            key={`skeleton-consumable-${index}`}
                            className="animate-pulse"
                          >
                            {Array.from({ length: 9 }).map((__, cellIndex) => (
                              <td
                                key={`cell-consumable-${cellIndex}`}
                                className="px-3 py-2.5"
                              >
                                <div className="h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      {!loading &&
                        assets.map((asset) => {
                          const expiryGroups =
                            consumableExpiryGroupsByQaCode[asset.qaCode] ||
                            buildConsumableExpiryGroups(asset);
                          const nearestGroup = expiryGroups[0];
                          const nearestExpiryState = getConsumableExpiryState({
                            ...asset,
                            expirationDate: nearestGroup?.expirationDate,
                          });
                          const specsCount = parseSpecsToEntries(
                            assetDetailsByQaCode[asset.qaCode]?.specs,
                          ).length;
                          const qty = Number(asset.quantityOnHand ?? 0);
                          const min = Number(asset.minimumStock ?? 0);
                          const formattedQty =
                            formatConsumableQuantityText(asset);
                          const formattedMin = formatConsumableQuantityText(
                            asset,
                            {
                              quantityField: "minimumStock",
                              formattedField: "formattedMinimumStock",
                            },
                          );
                          // qty=0 luôn cảnh báo; qty>0 nhưng dưới ngưỡng → amber; ok → emerald
                          const stockTone =
                            qty <= 0
                              ? "red"
                              : min > 0 && qty <= min
                                ? "amber"
                                : "emerald";
                          const storageLocation = asset.homeLocationName || "–";
                          const inventoryValue = calculateInventoryValue(asset);
                          return (
                            <tr
                              key={asset.qaCode}
                              className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60"
                            >
                              <td
                                className="truncate px-3 py-2 font-semibold text-slate-600 dark:text-slate-300"
                                title={asset.qaCode}
                              >
                                {asset.qaCode}
                              </td>
                              <td
                                className="truncate px-3 py-2 font-medium text-slate-800 dark:text-slate-100"
                                title={asset.name}
                              >
                                {asset.name}
                              </td>
                              <td
                                className="truncate px-3 py-2 text-slate-600 dark:text-slate-300"
                                title={asset.category}
                              >
                                {asset.category || "–"}
                              </td>
                              <td
                                className="truncate px-3 py-2 text-slate-600 dark:text-slate-300"
                                title={storageLocation}
                              >
                                {storageLocation}
                              </td>
                              <td
                                className="truncate px-3 py-2"
                                title={
                                  stockTone === "red"
                                    ? "Hết hàng"
                                    : stockTone === "amber"
                                      ? "Cần nhập"
                                      : "Đủ dùng"
                                }
                              >
                                <span
                                  className={`font-semibold tabular-nums ${stockTone === "red" ? "text-red-600 dark:text-red-400" : stockTone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}
                                >
                                  {formattedQty}
                                </span>
                                {min > 0 && (
                                  <span className="text-slate-400 dark:text-slate-500">
                                    {" "}
                                    / {formattedMin}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSpecsModal(asset)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
                                >
                                  <Detail size={13} />
                                  <span>
                                    {specsCount > 0
                                      ? `${specsCount} mục`
                                      : "Xem"}
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {asset.expiryTrackingEnabled ? (
                                  nearestExpiryState.dateLabel ===
                                  "Chưa cập nhật" ? (
                                    <span
                                      title={nearestExpiryState.label}
                                      className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(nearestExpiryState.tone)}`}
                                    >
                                      Chưa HSD
                                    </span>
                                  ) : (
                                    <span
                                      title={nearestExpiryState.label}
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${getStatusBadgeClass(nearestExpiryState.tone)}`}
                                    >
                                      {nearestExpiryState.dateLabel}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">
                                    –
                                  </span>
                                )}
                              </td>
                              <td
                                className="truncate px-3 py-2 text-right"
                                title={
                                  inventoryValue != null
                                    ? formatCurrency(inventoryValue)
                                    : undefined
                                }
                              >
                                {inventoryValue != null ? (
                                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                    {formatCurrencyCompact(inventoryValue)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500">
                                    –
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex justify-end gap-0.5">
                                  <ActionIconButton
                                    icon={PackagePlus}
                                    label="Nhập hàng"
                                    variant="success"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      handleOpenReceiveModal(asset)
                                    }
                                  />
                                  {!isConsumableManager && (
                                    <ActionIconButton
                                      icon={Send}
                                      label="Cấp phát"
                                      variant="info"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        handleOpenIssueModal(asset)
                                      }
                                    />
                                  )}
                                  <ActionIconButton
                                    icon={Wrench}
                                    label="Sửa vật tư"
                                    variant="primary"
                                    className="h-7 w-7"
                                    onClick={() => handleSelectAsset(asset)}
                                  />
                                  <ActionIconButton
                                    icon={Trash2}
                                    label="Xóa vật tư"
                                    variant="danger"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      handleDeleteAsset(asset.qaCode)
                                    }
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {!loading && assets.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                          >
                            Chưa có vật tư tiêu hao phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {!loading && pageInfo.totalItems > 0 && (
                  <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Hiển thị {assets.length} / {pageInfo.totalItems} vật tư
                    </p>
                    <div className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <button
                        type="button"
                        onClick={goToFirstPage}
                        disabled={currentPage === 1}
                        className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Trang đầu"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        onClick={goToPrevPage}
                        disabled={currentPage === 1}
                        className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Trang trước"
                      >
                        ‹
                      </button>
                      <span className="min-w-16 rounded-md bg-orange-50 px-3 py-1.5 text-center text-xs font-bold text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={goToNextPage}
                        disabled={currentPage >= totalPages}
                        className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Trang tiếp"
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        onClick={goToLastPage}
                        disabled={currentPage >= totalPages}
                        className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Trang cuối"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : consumableWorkspace === "ROOMS" ? (
            <ConsumableRoomsTab
              roomOptions={roomOptions}
              selectedRoomId={selectedRoomId}
              onRoomChange={handleRoomChange}
              roomOverview={roomOverview}
              roomOverviewLoading={roomOverviewLoading}
              isAdmin={isAdmin}
              canIssueFromWarehouse={!isConsumableManager}
              onOpenConsumableRequestModal={handleOpenConsumableRequestModal}
              onOpenIssueModalFromRoomStock={handleOpenIssueModalFromRoomStock}
              onOpenStockAdjustModal={handleOpenStockAdjustModal}
              onOpenConsumableDecisionModal={handleOpenConsumableDecisionModal}
            />
          ) : consumableWorkspace === "DISPOSAL" ? (
            <ConsumableDisposalTab
              expiredLots={expiredLots}
              expiredLotsLoading={expiredLotsLoading}
              disposalRequestsLoading={disposalRequestsLoading}
              filteredDisposalRequests={filteredDisposalRequests}
              pagedDisposalRequests={pagedDisposalRequests}
              disposalHistoryFilters={disposalHistoryFilters}
              onDisposalHistoryFiltersChange={
                handleDisposalHistoryFiltersChange
              }
              disposalHistoryPage={disposalHistoryPage}
              disposalHistoryTotalPages={disposalHistoryTotalPages}
              disposalPageSize={DISPOSAL_PAGE_SIZE}
              onDisposalHistoryPageChange={setDisposalHistoryPage}
              pendingDisposalCount={pendingDisposalCount}
              isAdmin={isAdmin}
              downloadingDisposalRequestId={downloadingDisposalRequestId}
              onOpenDisposalRequestModal={handleOpenDisposalRequestModal}
              onOpenDisposalDecisionModal={handleOpenDisposalDecisionModal}
              onDownloadDisposalDocument={handleDownloadDisposalDocument}
              onSelectDisposalHistoryRequest={setSelectedDisposalHistoryRequest}
            />
          ) : (
            <ConsumableRequestsTab
              pendingConsumableRequests={pendingConsumableRequests}
              pendingConsumableRequestsLoading={
                pendingConsumableRequestsLoading
              }
              pendingDisposalRequests={pendingDisposalRequests}
              pendingDisposalRequestsLoading={pendingDisposalRequestsLoading}
              downloadingDisposalRequestId={downloadingDisposalRequestId}
              readOnly={isAdmin}
              onOpenConsumableDecisionModal={handleOpenConsumableDecisionModal}
              onOpenDisposalDecisionModal={handleOpenDisposalDecisionModal}
            />
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={itemizedFilterDraft.name}
                  onChange={(e) =>
                    setItemizedFilterDraft((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Tìm tên hoặc mã QA"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${showAdvancedFilters ? "border-fptOrange bg-orange-50 text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300" : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
                  />
                  Bộ lọc nâng cao
                </button>
                {hasActiveItemizedFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    Loại thiết bị
                  </label>
                  <SearchableSelect
                    value={itemizedFilterDraft.categoryId}
                    onChange={(nextValue) => {
                      const categoryId = String(nextValue || "");
                      setItemizedFilterDraft((prev) => ({
                        ...prev,
                        categoryId,
                        categoryKeyword:
                          getCategoryLabel(
                            categories.find(
                              (category) => String(category.id) === categoryId,
                            ),
                          ) || "",
                      }));
                    }}
                    options={filteredCategoryOptions}
                    getOptionValue={(category) => category.id}
                    getOptionLabel={(category) => getCategoryLabel(category)}
                    placeholder="Gõ để tìm loại thiết bị"
                    emptyOptionLabel="Tất cả loại"
                    inputClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    Tình trạng kỹ thuật
                  </label>
                  <select
                    value={itemizedFilterDraft.technicalStatus}
                    onChange={(e) =>
                      setItemizedFilterDraft((prev) => ({
                        ...prev,
                        status: "",
                        technicalStatus: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Tất cả kỹ thuật</option>
                    {technicalStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    Trạng thái sử dụng
                  </label>
                  <select
                    value={itemizedFilterDraft.usageStatus}
                    onChange={(e) =>
                      setItemizedFilterDraft((prev) => ({
                        ...prev,
                        status: "",
                        usageStatus: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Tất cả sử dụng</option>
                    {usageStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    Phòng / vị trí
                  </label>
                  <SearchableSelect
                    value={itemizedFilterDraft.locationId}
                    onChange={(nextValue) => {
                      const locationId = String(nextValue || "");
                      const location = sortedLocations.find(
                        (item) => String(item.id) === locationId,
                      );
                      setItemizedFilterDraft((prev) => ({
                        ...prev,
                        locationId,
                        locationKeyword: location?.roomName || "",
                      }));
                    }}
                    options={sortedLocations}
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName}
                    placeholder="Gõ để tìm phòng / vị trí"
                    emptyOptionLabel="Tất cả phòng"
                    inputClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Danh sách tài sản cố định
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!qrSelectionMode ? (
                  <button
                    type="button"
                    onClick={() => setQrSelectionMode(true)}
                    disabled={loading || itemizedAssetsOnPage.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                  >
                    <Printer size={14} />
                    In mã QR
                  </button>
                ) : (
                  <>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      Đã chọn {selectedQrAssets.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenBulkQrPreview}
                      disabled={
                        loading ||
                        bulkQrPrinting ||
                        selectedQrAssets.length === 0
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                    >
                      <Printer size={14} />
                      {bulkQrPrinting ? "Đang tải QR..." : "In QR đã chọn"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelQrSelection}
                      disabled={bulkQrPrinting}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Hủy chọn
                    </button>
                  </>
                )}
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Tổng: {pageInfo.totalItems}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
              <table
                className={`${qrSelectionMode ? "min-w-[1180px]" : "min-w-[1120px]"} divide-y divide-slate-200 text-xs dark:divide-slate-800`}
              >
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    {qrSelectionMode && (
                      <th className="w-10 px-3 py-2 text-left font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={allPageQrSelected}
                          disabled={
                            loading || itemizedAssetsOnPage.length === 0
                          }
                          onChange={handleToggleAllPageQrSelection}
                          aria-label={
                            somePageQrSelected
                              ? "Chọn tất cả tài sản còn lại trên trang"
                              : "Chọn tất cả tài sản trên trang"
                          }
                          className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                        />
                      </th>
                    )}
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => handleSort("qaCode")}
                        className="whitespace-nowrap hover:text-fptOrange"
                      >
                        {getSortLabel("qaCode", "Mã QA")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => handleSort("name")}
                        className="whitespace-nowrap hover:text-fptOrange"
                      >
                        {getSortLabel("name", "Tên thiết bị")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      Vị trí hiện tại
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => handleSort("homeLocationName")}
                        className="whitespace-nowrap hover:text-fptOrange"
                      >
                        {getSortLabel("homeLocationName", "Vị trí gốc")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => handleSort("status")}
                        className="whitespace-nowrap hover:text-fptOrange"
                      >
                        {getSortLabel("status", "Tình trạng kỹ thuật")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      Trạng thái sử dụng
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => handleSort("createdAt")}
                        className="whitespace-nowrap hover:text-fptOrange"
                      >
                        {getSortLabel("createdAt", "Ngày tạo")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading &&
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="animate-pulse">
                        {Array.from({ length: qrSelectionMode ? 9 : 8 }).map(
                          (__, cellIndex) => (
                            <td key={`cell-${cellIndex}`} className="px-3 py-2">
                              <div className="h-3.5 w-24 rounded bg-slate-200" />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  {!loading &&
                    assets.map((asset) => {
                      const homeLocation =
                        asset.homeLocationName || asset.homeLocationId || "-";
                      const currentLocation =
                        asset.locationName ||
                        asset.currentLocationName ||
                        asset.homeLocationName ||
                        asset.homeLocationId ||
                        "-";
                      return (
                        <tr
                          key={asset.qaCode}
                          className="bg-white hover:bg-orange-50/30 dark:bg-slate-950 dark:hover:bg-slate-900/60"
                        >
                          {qrSelectionMode && (
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedQrQaCodes.has(asset.qaCode)}
                                onChange={() => handleToggleQrSelection(asset)}
                                aria-label={`Chọn ${asset.qaCode} để in QR`}
                                className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                              />
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                            {asset.qaCode}
                          </td>
                          <td className="max-w-[220px] px-3 py-2">
                            <p
                              className="truncate font-medium text-slate-800 dark:text-slate-100"
                              title={asset.name}
                            >
                              {asset.name}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                            {currentLocation}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                            {homeLocation}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                            {getTechnicalStatusLabel(
                              asset.technicalStatus || asset.status,
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                            {getUsageStatusLabel(asset.usageStatus)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">
                            {formatDate(asset.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              <ActionIconButton
                                icon={QrCode}
                                label="Xem mã QR"
                                variant="success"
                                onClick={() => handleOpenQrModal(asset)}
                                disabled={qrModalLoading}
                              />
                              <ActionIconButton
                                icon={Wrench}
                                label="Chỉnh sửa"
                                variant="primary"
                                onClick={() => handleSelectAsset(asset)}
                              />
                              <div className="relative">
                                <button
                                  type="button"
                                  title="Thêm thao tác"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    if (openActionMenuQaCode === asset.qaCode) {
                                      setOpenActionMenuQaCode(null);
                                    } else {
                                      const rect =
                                        e.currentTarget.getBoundingClientRect();
                                      const menuHeight = 210;
                                      const spaceBelow =
                                        window.innerHeight - rect.bottom;
                                      const rightOffset =
                                        window.innerWidth - rect.right;
                                      if (spaceBelow < menuHeight) {
                                        setActionMenuPos({
                                          top: "auto",
                                          bottom:
                                            window.innerHeight - rect.top + 4,
                                          right: rightOffset,
                                        });
                                      } else {
                                        setActionMenuPos({
                                          top: rect.bottom + 4,
                                          bottom: "auto",
                                          right: rightOffset,
                                        });
                                      }
                                      setOpenActionMenuQaCode(asset.qaCode);
                                    }
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                                >
                                  <ChevronDown size={14} />
                                </button>
                                {openActionMenuQaCode === asset.qaCode && (
                                  <div
                                    onPointerDown={(e) => e.stopPropagation()}
                                    style={{
                                      position: "fixed",
                                      top: actionMenuPos.top,
                                      bottom: actionMenuPos.bottom,
                                      right: actionMenuPos.right,
                                      zIndex: 9999,
                                    }}
                                    className="w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenSpecsModal(asset)
                                      }
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-200 dark:hover:bg-orange-500/10"
                                    >
                                      <Detail size={14} />{" "}
                                      {getSpecLabelByTrackingMode(
                                        asset?.trackingMode,
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const detail = await fetchAssetDetail(
                                            asset.qaCode,
                                          );
                                          setSelectedOriginAsset(detail);
                                          setShowOriginModal(true);
                                          setOpenActionMenuQaCode(null);
                                        } catch (error) {
                                          const message =
                                            error?.response?.data?.message ||
                                            "Không thể tải nguồn gốc tài sản của thiết bị.";
                                          toast.error(message);
                                        }
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-200 dark:hover:bg-orange-500/10"
                                    >
                                      <Search size={14} /> Nguồn gốc
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handlePrintQr(asset);
                                        setOpenActionMenuQaCode(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-200 dark:hover:bg-orange-500/10"
                                    >
                                      <Printer size={14} /> In mã QR
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTimelineAsset(asset);
                                        setShowTimelineModal(true);
                                        setOpenActionMenuQaCode(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-fptOrange dark:text-slate-200 dark:hover:bg-orange-500/10"
                                    >
                                      <History size={14} /> Lịch sử sửa chữa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteAsset(asset.qaCode);
                                        setOpenActionMenuQaCode(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                    >
                                      <Trash2 size={14} /> Xóa tài sản
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {!loading && assets.length === 0 && (
                    <tr>
                      <td
                        colSpan={qrSelectionMode ? 8 : 7}
                        className="px-3 py-6 text-center text-sm text-slate-500"
                      >
                        Chưa có tài sản cố định phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!loading && pageInfo.totalItems > 0 && (
              <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hiển thị {assets.length} / {pageInfo.totalItems} tài sản
                </p>
                <div className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={goToFirstPage}
                    disabled={currentPage === 1}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Trang đầu"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Trang trước"
                  >
                    ‹
                  </button>
                  <span className="min-w-16 rounded-md bg-orange-50 px-3 py-1.5 text-center text-xs font-bold text-fptOrangeDark dark:bg-orange-500/10 dark:text-orange-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={currentPage >= totalPages}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Trang tiếp"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={goToLastPage}
                    disabled={currentPage >= totalPages}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    title="Trang cuối"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showFormModal && (
        <ModalOverlay zIndex={100} className="bg-slate-900/60">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950 sm:max-h-[calc(100dvh-3rem)]">
            {/* Sticky header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-6 sm:py-4">
              <div>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {isEditing
                    ? `Chỉnh sửa ${isConsumableForm ? "vật tư" : "thiết bị"}`
                    : `Thêm mới ${isConsumableForm ? "vật tư tiêu hao" : "thiết bị"}`}
                </h4>
                {isEditing && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Mã: {selectedQaCode}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>
            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-x-4 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {isConsumableForm ? "Tên vật tư" : "Tên thiết bị"}
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, name: e.target.value }));
                      setFormErrors((prev) => ({ ...prev, name: "" }));
                    }}
                    className={getFieldClass(Boolean(formErrors.name))}
                    placeholder={
                      isConsumableForm
                        ? "Nhập tên vật tư tiêu hao"
                        : "Nhập tên thiết bị"
                    }
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {isConsumableForm ? "Loại vật tư" : "Loại thiết bị"}
                  </label>
                  <SearchableSelect
                    value={form.categoryId}
                    onChange={(nextValue) =>
                      handleCategoryChange(String(nextValue || ""))
                    }
                    options={formCategoryOptions}
                    getOptionValue={(category) => category.id}
                    getOptionLabel={(category) => getCategoryLabel(category)}
                    placeholder="Gõ để tìm loại"
                    emptyOptionLabel="Chọn loại"
                    inputClassName={getFieldClass(
                      Boolean(formErrors.categoryId),
                    )}
                  />
                  {formErrors.categoryId && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.categoryId}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    Chỉ hiển thị category phù hợp với kiểu theo dõi đang chọn.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {isConsumableForm ? "Kho lưu trữ" : "Phòng gốc"}
                  </label>
                  <SearchableSelect
                    value={form.locationId}
                    onChange={(nextValue) => {
                      setForm((prev) => ({
                        ...prev,
                        locationId: String(nextValue || ""),
                      }));
                      setFormErrors((prev) => ({ ...prev, locationId: "" }));
                    }}
                    options={isConsumableForm ? warehouseLocations : locations}
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName}
                    placeholder={
                      isConsumableForm ? "Kho lưu trữ" : "Gõ để tìm phòng"
                    }
                    emptyOptionLabel={
                      isConsumableForm ? undefined : "Chọn phòng"
                    }
                    inputClassName={getFieldClass(
                      Boolean(formErrors.locationId),
                    )}
                  />
                  {formErrors.locationId && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.locationId}
                    </p>
                  )}
                  {isConsumableForm && (
                    <p className="mt-1 text-xs text-slate-500">
                      Chỉ hiển thị các khu vực có loại được đánh dấu là kho lưu
                      trữ.
                    </p>
                  )}
                </div>
                {!isConsumableForm && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Tình trạng kỹ thuật
                      </label>
                      <select
                        value={form.technicalStatus}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            technicalStatus: e.target.value,
                          }));
                          setFormErrors((prev) => ({
                            ...prev,
                            technicalStatus: "",
                          }));
                        }}
                        className={getFieldClass(
                          Boolean(formErrors.technicalStatus),
                        )}
                      >
                        {technicalStatusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.technicalStatus && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.technicalStatus}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Trạng thái sử dụng
                      </label>
                      <select
                        value={form.usageStatus}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            usageStatus: e.target.value,
                          }));
                          setFormErrors((prev) => ({
                            ...prev,
                            usageStatus: "",
                          }));
                        }}
                        className={getFieldClass(
                          Boolean(formErrors.usageStatus),
                        )}
                      >
                        {usageStatusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      {formErrors.usageStatus && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.usageStatus}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        `Tình trạng kỹ thuật` và `Trạng thái sử dụng` được lưu
                        riêng để tránh chồng nghĩa giữa hỏng và đang sửa chữa.
                      </p>
                    </div>
                  </>
                )}
                {isConsumableForm && (
                  <>
                    <div className="md:col-span-2 lg:col-span-3">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Đơn vị lẻ
                          </label>
                          <input
                            value={form.retailUnit}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                retailUnit: e.target.value,
                              }));
                              setFormErrors((prev) => ({
                                ...prev,
                                retailUnit: "",
                              }));
                            }}
                            className={getFieldClass(
                              Boolean(formErrors.retailUnit),
                            )}
                            placeholder="Ví dụ: cây, tờ, viên"
                          />
                          {formErrors.retailUnit && (
                            <p className="mt-1 text-xs text-red-600">
                              {formErrors.retailUnit}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Đơn vị sỉ
                          </label>
                          <input
                            value={form.wholesaleUnit}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                wholesaleUnit: e.target.value,
                              }));
                              setFormErrors((prev) => ({
                                ...prev,
                                wholesaleUnit: "",
                              }));
                            }}
                            className={getFieldClass(
                              Boolean(formErrors.wholesaleUnit),
                            )}
                            placeholder="Ví dụ: hộp, ram, vỉ"
                          />
                          {formErrors.wholesaleUnit && (
                            <p className="mt-1 text-xs text-red-600">
                              {formErrors.wholesaleUnit}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            1 sỉ = n lẻ
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={form.wholesaleToRetailFactor}
                            onChange={(e) => {
                              setForm((prev) => ({
                                ...prev,
                                wholesaleToRetailFactor: e.target.value,
                              }));
                              setFormErrors((prev) => ({
                                ...prev,
                                wholesaleToRetailFactor: "",
                              }));
                            }}
                            className={getFieldClass(
                              Boolean(formErrors.wholesaleToRetailFactor),
                            )}
                            placeholder="Ví dụ: 20"
                          />
                          {formErrors.wholesaleToRetailFactor && (
                            <p className="mt-1 text-xs text-red-600">
                              {formErrors.wholesaleToRetailFactor}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Số lượng nhập kho ban đầu
                      </label>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.65fr)]">
                        <input
                          type="number"
                          min="0"
                          value={form.quantityOnHand}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              quantityOnHand: e.target.value,
                            }));
                            setFormErrors((prev) => ({
                              ...prev,
                              quantityOnHand: "",
                            }));
                          }}
                          disabled={isEditing}
                          className={`${getFieldClass(Boolean(formErrors.quantityOnHand))} ${isEditing ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
                          placeholder={`Ví dụ: 10 ${getConsumableQuantityInputUnit(form, form.quantityOnHandUnit)}`}
                        />
                        <select
                          value={form.quantityOnHandUnit}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              quantityOnHandUnit: e.target.value,
                            }));
                            setFormErrors((prev) => ({
                              ...prev,
                              quantityOnHandUnit: "",
                            }));
                          }}
                          disabled={isEditing}
                          className={`${getFieldClass(Boolean(formErrors.quantityOnHandUnit))} ${isEditing ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
                        >
                          <option value="RETAIL">
                            {getConsumableRetailUnit(form)}
                          </option>
                          <option value="WHOLESALE">
                            {getConsumableWholesaleUnit(form)}
                          </option>
                        </select>
                      </div>
                      {formErrors.quantityOnHand && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.quantityOnHand}
                        </p>
                      )}
                      {formErrors.quantityOnHandUnit && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.quantityOnHandUnit}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Bạn có thể nhập tồn ban đầu theo đơn vị sỉ hoặc lẻ; hệ
                        thống sẽ tự quy đổi về đơn vị lẻ và hiển thị theo kiểu
                        sỉ + lẻ.
                      </p>
                      {isEditing && (
                        <p className="mt-1 text-xs text-slate-500">
                          Tồn kho tổng được quản lý theo từng lô nhập, vui lòng
                          dùng `Nhập hàng` để tăng tồn.
                        </p>
                      )}
                        </div>
                        <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Ngưỡng cảnh báo tồn
                      </label>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.65fr)]">
                        <input
                          type="number"
                          min="0"
                          value={form.minimumStock}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              minimumStock: e.target.value,
                            }));
                            setFormErrors((prev) => ({
                              ...prev,
                              minimumStock: "",
                            }));
                          }}
                          className={getFieldClass(
                            Boolean(formErrors.minimumStock),
                          )}
                          placeholder={`Ví dụ: 20 ${getConsumableQuantityInputUnit(form, form.minimumStockUnit)}`}
                        />
                        <select
                          value={form.minimumStockUnit}
                          onChange={(e) => {
                            setForm((prev) => ({
                              ...prev,
                              minimumStockUnit: e.target.value,
                            }));
                            setFormErrors((prev) => ({
                              ...prev,
                              minimumStockUnit: "",
                            }));
                          }}
                          className={getFieldClass(
                            Boolean(formErrors.minimumStockUnit),
                          )}
                        >
                          <option value="RETAIL">
                            {getConsumableRetailUnit(form)}
                          </option>
                          <option value="WHOLESALE">
                            {getConsumableWholesaleUnit(form)}
                          </option>
                        </select>
                      </div>
                      {formErrors.minimumStock && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.minimumStock}
                        </p>
                      )}
                      {formErrors.minimumStockUnit && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.minimumStockUnit}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Ngưỡng cảnh báo tồn cũng có thể nhập theo sỉ hoặc lẻ; hệ
                        thống sẽ tự quy đổi về đơn vị lẻ để so sánh tồn kho thực
                        tế.
                      </p>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                      Hệ thống sẽ lưu tồn thực tế theo đơn vị lẻ và tự hiển thị
                      kiểu tổng hợp, ví dụ `1 hộp + 18 cây`.
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Quản lý hạn sử dụng
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Bật cho các mặt hàng như thực phẩm, thuốc thang hoặc
                            các vật tư cần theo dõi ngày hết hạn theo từng lô
                            nhập.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(form.expiryTrackingEnabled)}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setForm((prev) => ({
                                ...prev,
                                expiryTrackingEnabled: enabled,
                                expirationDate: enabled
                                  ? prev.expirationDate
                                  : "",
                              }));
                              setFormErrors((prev) => ({
                                ...prev,
                                expirationDate: "",
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                          />
                          <span>
                            {form.expiryTrackingEnabled
                              ? "Có quản lý hạn dùng"
                              : "Không quản lý hạn dùng"}
                          </span>
                        </label>
                      </div>
                      {form.expiryTrackingEnabled ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              {formMode === "edit"
                                ? "Lô gần hết hạn hiện tại"
                                : "Hạn dùng lô khởi tạo ban đầu"}
                            </label>
                            <input
                              type="date"
                              value={form.expirationDate}
                              onChange={(e) => {
                                setForm((prev) => ({
                                  ...prev,
                                  expirationDate: e.target.value,
                                }));
                                setFormErrors((prev) => ({
                                  ...prev,
                                  expirationDate: "",
                                }));
                              }}
                              disabled={formMode === "edit"}
                              className={getFieldClass(
                                Boolean(formErrors.expirationDate),
                              )}
                            />
                            {formErrors.expirationDate && (
                              <p className="mt-1 text-xs text-red-600">
                                {formErrors.expirationDate}
                              </p>
                            )}
                          </div>
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                            {formMode === "edit"
                              ? "Mặt hàng này đang quản lý hạn dùng theo từng lô. Muốn cập nhật hạn mới, hãy dùng chức năng Nhập hàng để tạo lô mới hoặc xử lý các lô tồn hiện có."
                              : "Khi tạo mới có tồn đầu kỳ, ngày này sẽ được lưu cho lô khởi tạo ban đầu. Các lần nhập hàng sau sẽ có hạn dùng riêng cho từng lô."}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs text-slate-500">
                          Nếu tắt, vật tư này vẫn quản lý tồn kho bình thường
                          nhưng không hiển thị cột cảnh báo hạn sử dụng.
                        </p>
                      )}
                    </div>
                  </>
                )}
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Nhà cung cấp
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetSupplierForm();
                        setShowSupplierCreateModal(true);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-300 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                      title="Thêm nhà cung cấp mới"
                      aria-label="Thêm nhà cung cấp mới"
                    >
                      +
                    </button>
                  </div>
                  <SearchableSelect
                    value={form.supplierId}
                    onChange={(nextValue) => {
                      setForm((prev) => ({
                        ...prev,
                        supplierId: String(nextValue || ""),
                      }));
                      setFormErrors((prev) => ({ ...prev, supplierId: "" }));
                    }}
                    options={suppliers}
                    getOptionValue={(supplier) => supplier.id}
                    getOptionLabel={(supplier) => getSupplierLabel(supplier)}
                    getOptionDescription={(supplier) =>
                      supplier.phoneNumber || "Chưa có SĐT"
                    }
                    placeholder="Gõ để tìm nhà cung cấp"
                    emptyOptionLabel="Chọn nhà cung cấp"
                    emptyText="Không có nhà cung cấp phù hợp."
                    inputClassName={getFieldClass(
                      Boolean(formErrors.supplierId),
                    )}
                  />
                  {formErrors.supplierId && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.supplierId}
                    </p>
                  )}
                  {isConsumableForm && (
                    <p className="mt-1 text-xs text-slate-500">
                      Trường này là tùy chọn với vật tư tiêu hao.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {isConsumableForm ? "Đơn giá" : "Giá mua"}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatPurchasePriceInput(form.purchasePrice)}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        purchasePrice: normalizePurchasePriceInput(
                          e.target.value,
                        ),
                      }));
                      setFormErrors((prev) => ({ ...prev, purchasePrice: "" }));
                    }}
                    disabled={isConsumableForm && isEditing}
                    className={`${getFieldClass(Boolean(formErrors.purchasePrice))} ${isConsumableForm && isEditing ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
                    placeholder={
                      isConsumableForm
                        ? `Nhập đơn giá 1 ${getConsumableQuantityInputUnit(form, form.quantityOnHandUnit)}, ví dụ 12.000`
                        : "Nhập giá mua, ví dụ 4.590.000"
                    }
                  />
                  {formErrors.purchasePrice && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.purchasePrice}
                    </p>
                  )}
                  {isConsumableForm && (
                    <p className="mt-1 text-xs text-slate-500">
                      {isEditing
                        ? "Đơn giá trung bình hiện tại được tổng hợp từ các lô nhập và không sửa trực tiếp tại đây."
                        : `Đây là đơn giá của 1 ${getConsumableQuantityInputUnit(form, form.quantityOnHandUnit)} ở bước tạo ban đầu.`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {isConsumableForm ? "Ngày nhập kho ban đầu" : "Ngày mua"}
                  </label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        purchaseDate: e.target.value,
                      }));
                      setFormErrors((prev) => ({
                        ...prev,
                        purchaseDate: "",
                        warrantyExpirationDate: "",
                      }));
                    }}
                    disabled={isConsumableForm && isEditing}
                    className={`${getFieldClass(Boolean(formErrors.purchaseDate))} ${isConsumableForm && isEditing ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}
                  />
                  {formErrors.purchaseDate && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.purchaseDate}
                    </p>
                  )}
                </div>
                {!isConsumableForm && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Hạn bảo hành
                    </label>
                    <input
                      type="date"
                      value={form.warrantyExpirationDate}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          warrantyExpirationDate: e.target.value,
                        }));
                        setFormErrors((prev) => ({
                          ...prev,
                          warrantyExpirationDate: "",
                        }));
                      }}
                      className={getFieldClass(
                        Boolean(formErrors.warrantyExpirationDate),
                      )}
                    />
                    {formErrors.warrantyExpirationDate && (
                      <p className="mt-1 text-xs text-red-600">
                        {formErrors.warrantyExpirationDate}
                      </p>
                    )}
                  </div>
                )}

                <div className="md:col-span-2 lg:col-span-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {formSpecLabel}
                    </label>
                    <button
                      type="button"
                      onClick={addCustomSpecEntry}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {formSpecAddButtonLabel}
                    </button>
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {form.specEntries.map((entry, index) => (
                      <div
                        key={entry.clientKey || `spec-${index}`}
                        className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
                      >
                        {entry.isCustom ? (
                          <input
                            value={entry.name}
                            onChange={(e) =>
                              updateSpecEntry(index, "name", e.target.value)
                            }
                            placeholder={getSpecNamePlaceholderByTrackingMode(
                              form.trackingMode,
                            )}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                          />
                        ) : (
                          <input
                            value={entry.name}
                            disabled
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                          />
                        )}
                        <input
                          value={entry.value}
                          onChange={(e) =>
                            updateSpecEntry(index, "value", e.target.value)
                          }
                          placeholder={getSpecValuePlaceholderByTrackingMode(
                            form.trackingMode,
                          )}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2"
                        />
                        <button
                          type="button"
                          onClick={() => removeSpecEntry(index)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50"
                          title={`Xóa ${formSpecTemplateLabel.toLowerCase()}`}
                          aria-label={`Xóa ${formSpecTemplateLabel.toLowerCase()}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {form.specEntries.length === 0 && (
                      <p className="text-sm text-slate-500">
                        {getEmptySpecEntriesMessageByTrackingMode(
                          form.trackingMode,
                        )}
                      </p>
                    )}
                  </div>
                  {formErrors.specEntries && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.specEntries}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/* Sticky footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleCreateAsset}
                  disabled={submitting}
                  className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                >
                  {submitting ? "Đang xử lý..." : "Thêm mới"}
                </button>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={handleUpdateAsset}
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Đang lưu..." : "Lưu chỉnh sửa"}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {showIssueModal && selectedIssueAsset && (
        <ModalOverlay zIndex={105} className="bg-slate-900/50">
          <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  Cấp phát vật phẩm - {selectedIssueAsset.name}
                </h4>
                <p className="text-sm text-slate-500">
                  Tồn hiện tại:{" "}
                  {formatConsumableQuantityText(selectedIssueAsset)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeIssueModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Phòng nhận
                  </label>
                  <SearchableSelect
                    value={issueForm.issuedToLocationId}
                    onChange={(nextValue) =>
                      setIssueForm((prev) => ({
                        ...prev,
                        issuedToLocationId: String(nextValue || ""),
                      }))
                    }
                    options={locations}
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName}
                    placeholder="Gõ để tìm phòng nhận"
                    emptyOptionLabel="Chọn phòng nhận"
                    inputClassName={getFieldClass(false)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Xuất từ kho
                  </label>
                  <SearchableSelect
                    value={issueForm.sourceWarehouseLocationId}
                    onChange={(nextValue) =>
                      setIssueForm((prev) => ({
                        ...prev,
                        sourceWarehouseLocationId: String(nextValue || ""),
                      }))
                    }
                    options={issueWarehouseOptions}
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName}
                    getOptionDescription={(location) =>
                      `${formatConsumableQuantityText(location, { quantityField: "quantityRemaining", formattedField: "formattedQuantityRemaining" })} còn khả dụng${location.lotCount ? ` • ${location.lotCount} lô` : ""}`
                    }
                    placeholder="Gõ để tìm kho xuất"
                    emptyOptionLabel="Chọn kho xuất"
                    inputClassName={getFieldClass(false)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Số lượng cấp phát
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={issueForm.quantity}
                    onChange={(e) =>
                      setIssueForm((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                    placeholder={`Ví dụ: 10 ${getConsumableRetailUnit(selectedIssueAsset)}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ghi chú
                  </label>
                  <textarea
                    rows={3}
                    value={issueForm.note}
                    onChange={(e) =>
                      setIssueForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                    placeholder="Ghi chú đợt cấp phát này"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleIssueConsumable}
                  disabled={issueSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Xác nhận cấp phát
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">
                    Tồn theo phòng
                  </h5>
                  {issueHistoryLoading && (
                    <span className="text-xs text-slate-500">Đang tải...</span>
                  )}
                </div>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {issueLocationStocks.map((stock) => (
                    <div
                      key={`${stock.assetQaCode}-${stock.locationId}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-700">
                            {stock.locationName}
                          </p>
                          <p className="text-slate-500">
                            Đã cấp:{" "}
                            {stock.formattedQuantityIssued ||
                              formatConsumableQuantityText(stock, {
                                quantityField: "quantityIssued",
                                formattedField: "formattedQuantityIssued",
                              })}
                          </p>
                          <p className="text-slate-500">
                            Còn lại:{" "}
                            {stock.formattedQuantityRemaining ||
                              formatConsumableQuantityText(stock, {
                                quantityField: "quantityRemaining",
                                formattedField: "formattedQuantityRemaining",
                              })}{" "}
                            • Đã dùng:{" "}
                            {stock.formattedQuantityConsumed ||
                              formatConsumableQuantityText(stock, {
                                quantityField: "quantityConsumed",
                                formattedField: "formattedQuantityConsumed",
                              })}
                          </p>
                          <p className="text-slate-500">
                            Đơn giá: {formatCurrency(stock.unitPrice)} • Giá trị
                            còn lại: {formatCurrency(stock.remainingValue)}
                          </p>
                          <p className="text-slate-500">
                            Cập nhật gần nhất:{" "}
                            {formatDateTime(stock.lastUpdatedAt)} •{" "}
                            {getActorName(stock)}
                          </p>
                          {stock.lastNote && (
                            <p className="mt-1 text-slate-600">
                              {stock.lastNote}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenStockAdjustModal(stock)}
                          className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          Cập nhật còn lại
                        </button>
                      </div>
                    </div>
                  ))}
                  {issueLocationStocks.length === 0 && !issueHistoryLoading && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Vật tư này chưa được cấp phát cho phòng nào.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">
                    Lịch sử cấp phát
                  </h5>
                  {issueHistoryLoading && (
                    <span className="text-xs text-slate-500">Đang tải...</span>
                  )}
                </div>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {issueHistory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-medium text-slate-700">
                        {item.formattedQuantity ||
                          formatConsumableQuantityText(item, {
                            quantityField: "quantity",
                            formattedField: "formattedQuantity",
                          })}{" "}
                        {"->"} {item.issuedToLocationName}
                      </p>
                      <p className="text-slate-500">
                        Xuất từ kho:{" "}
                        {item.sourceWarehouseLocationName || "Chưa ghi nhận"}
                      </p>
                      <p className="text-slate-500">
                        {item.issuedByFullName || item.issuedByUsername} •{" "}
                        {formatDateTime(item.issuedAt)}
                      </p>
                      <p className="text-slate-500">
                        Đơn giá lúc cấp phát: {formatCurrency(item.unitPrice)}
                      </p>
                      {item.note && (
                        <p className="mt-1 text-slate-600">{item.note}</p>
                      )}
                    </div>
                  ))}
                  {issueHistory.length === 0 && !issueHistoryLoading && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có lịch sử cấp phát.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showReceiveModal && selectedReceiveAsset && (
        <ModalOverlay zIndex={107} className="bg-slate-900/50">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  Nhập hàng vật tư
                </h4>
                <p className="text-sm text-slate-500">
                  {selectedReceiveAsset.name} • Tồn kho hiện tại:{" "}
                  {formatConsumableQuantityText(selectedReceiveAsset)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReceiveModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto pr-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>
                  Kho mặc định của vật tư:{" "}
                  {selectedReceiveAsset.homeLocationName ||
                    selectedReceiveAsset.locationName ||
                    "Chưa cập nhật"}
                </p>
                <p>
                  Đơn giá trung bình hiện tại:{" "}
                  {formatCurrency(selectedReceiveAsset.purchasePrice)}
                </p>
                <p>
                  Quản lý hạn dùng theo lô:{" "}
                  {selectedReceiveAsset.expiryTrackingEnabled ? "Có" : "Không"}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Số lượng nhập
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={receiveForm.quantity}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                    placeholder={`Ví dụ: 10 ${getConsumableQuantityInputUnit(selectedReceiveAsset, receiveForm.quantityUnit)}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nhập theo đơn vị
                  </label>
                  <select
                    value={receiveForm.quantityUnit}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        quantityUnit: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                  >
                    <option value="WHOLESALE">
                      {getConsumableWholesaleUnit(selectedReceiveAsset)}
                    </option>
                    <option value="RETAIL">
                      {getConsumableRetailUnit(selectedReceiveAsset)}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Đơn giá lô nhập
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatPurchasePriceInput(receiveForm.unitPrice)}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        unitPrice: normalizePurchasePriceInput(e.target.value),
                      }))
                    }
                    className={getFieldClass(false)}
                    placeholder="Ví dụ: 12.000"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Đơn giá nhập được hiểu theo đơn vị bạn chọn ở phía trên.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mã lô
                  </label>
                  <input
                    value={receiveForm.lotCode}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        lotCode: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                    placeholder="Ví dụ: LOT-202605"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ngày nhập lô
                  </label>
                  <input
                    type="date"
                    value={receiveForm.receivedDate}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        receivedDate: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nhập vào kho
                  </label>
                  <SearchableSelect
                    value={receiveForm.warehouseLocationId}
                    onChange={(nextValue) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        warehouseLocationId: String(nextValue || ""),
                      }))
                    }
                    options={warehouseLocations}
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName}
                    getOptionDescription={(location) =>
                      location.floorName ||
                      location.areaTypeLabel ||
                      "Kho lưu trữ"
                    }
                    placeholder="Gõ để tìm kho nhập"
                    emptyOptionLabel="Chọn kho nhập"
                    inputClassName={getFieldClass(false)}
                  />
                </div>
                {selectedReceiveAsset.expiryTrackingEnabled && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Hạn sử dụng của lô
                    </label>
                    <input
                      type="date"
                      value={receiveForm.expirationDate}
                      onChange={(e) =>
                        setReceiveForm((prev) => ({
                          ...prev,
                          expirationDate: e.target.value,
                        }))
                      }
                      className={getFieldClass(false)}
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nhà cung cấp
                  </label>
                  <SearchableSelect
                    value={receiveForm.supplierId}
                    onChange={(nextValue) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        supplierId: String(nextValue || ""),
                      }))
                    }
                    options={suppliers}
                    getOptionValue={(supplier) => supplier.id}
                    getOptionLabel={(supplier) => getSupplierLabel(supplier)}
                    getOptionDescription={(supplier) =>
                      supplier.phoneNumber || "Chưa có SĐT"
                    }
                    placeholder="Gõ để tìm nhà cung cấp"
                    emptyOptionLabel="Chọn nhà cung cấp"
                    inputClassName={getFieldClass(false)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ghi chú lô nhập
                  </label>
                  <textarea
                    rows={3}
                    value={receiveForm.note}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className={getFieldClass(false)}
                    placeholder="Ví dụ: Lô nhập cho tủ thuốc phòng y tế"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-800">
                  Các lô đang có
                </p>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {(selectedReceiveAsset.receiptLots || []).length === 0 && (
                    <p className="text-sm text-slate-500">
                      Chưa có lô nhập nào được ghi nhận.
                    </p>
                  )}
                  {(selectedReceiveAsset.receiptLots || []).map((lot) => (
                    <div
                      key={lot.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-800">
                          {lot.lotCode || `Lô #${lot.id}`}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedReceiveAsset.expiryTrackingEnabled }).tone)}`}
                        >
                          {
                            getConsumableExpiryState({
                              ...lot,
                              expiryTrackingEnabled:
                                selectedReceiveAsset.expiryTrackingEnabled,
                            }).label
                          }
                        </span>
                      </div>
                      <p className="mt-1">
                        Còn lại:{" "}
                        {lot.formattedQuantityRemaining ||
                          formatConsumableQuantityText(
                            { ...selectedReceiveAsset, ...lot },
                            {
                              quantityField: "quantityRemaining",
                              formattedField: "formattedQuantityRemaining",
                            },
                          )}{" "}
                        /{" "}
                        {lot.formattedQuantityReceived ||
                          formatConsumableQuantityText(
                            { ...selectedReceiveAsset, ...lot },
                            {
                              quantityField: "quantityReceived",
                              formattedField: "formattedQuantityReceived",
                            },
                          )}
                      </p>
                      <p>
                        Kho nhập: {lot.warehouseLocationName || "Chưa gắn kho"}
                      </p>
                      <p>
                        Ngày nhập: {formatDate(lot.receivedDate)} | Hạn dùng:{" "}
                        {
                          getConsumableExpiryState({
                            ...lot,
                            expiryTrackingEnabled:
                              selectedReceiveAsset.expiryTrackingEnabled,
                          }).dateLabel
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleReceiveConsumable}
                disabled={receiveSubmitting}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                Xác nhận nhập hàng
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showConsumableRequestModal && (
        <ModalOverlay zIndex={107} className="bg-slate-900/50">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  Yêu cầu cấp phát vật tư
                </h4>
                <p className="text-sm text-slate-500">
                  {roomOverview?.locationName
                    ? `Phòng nhận: ${roomOverview.locationName}`
                    : "Chọn phòng trước khi gửi yêu cầu cấp phát."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConsumableRequestModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto pr-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Vật tư cần cấp phát
                </label>
                <SearchableSelect
                  value={consumableRequestForm.assetQaCode}
                  onChange={async (nextValue) => {
                    const qaCode = String(nextValue || "");
                    const detail = qaCode
                      ? await fetchAssetDetail(qaCode).catch(() => null)
                      : null;
                    const nextWarehouseOptions =
                      buildWarehouseOptionsFromAssetDetail(
                        detail,
                        warehouseLocations,
                      );
                    setSelectedRequestAssetQaCode(qaCode);
                    setConsumableRequestForm((prev) => ({
                      ...prev,
                      assetQaCode: qaCode,
                      sourceWarehouseLocationId: String(
                        detail?.homeLocationId ||
                          nextWarehouseOptions[0]?.id ||
                          "",
                      ),
                    }));
                  }}
                  options={consumableRequestAssetOptions}
                  getOptionValue={(option) => option.qaCode}
                  getOptionLabel={(option) =>
                    `${option.name} (${option.qaCode})`
                  }
                  getOptionSearchText={(option) =>
                    `${option.name} ${option.qaCode}`
                  }
                  placeholder="Gõ để tìm vật tư"
                  emptyOptionLabel="Chọn vật tư"
                  inputClassName={getFieldClass(false)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Kho xuất đề nghị
                </label>
                <SearchableSelect
                  value={consumableRequestForm.sourceWarehouseLocationId}
                  onChange={(nextValue) =>
                    setConsumableRequestForm((prev) => ({
                      ...prev,
                      sourceWarehouseLocationId: String(nextValue || ""),
                    }))
                  }
                  options={consumableRequestWarehouseOptions}
                  getOptionValue={(location) => location.id}
                  getOptionLabel={(location) => location.roomName}
                  getOptionDescription={(location) =>
                    `${formatConsumableQuantityText({ ...selectedRequestAssetDetail, ...location }, { quantityField: "quantityRemaining", formattedField: "formattedQuantityRemaining" })} còn khả dụng${location.lotCount ? ` • ${location.lotCount} lô` : ""}`
                  }
                  placeholder="Gõ để tìm kho xuất"
                  emptyOptionLabel="Chọn kho xuất"
                  inputClassName={getFieldClass(false)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Số lượng cần cấp phát
                </label>
                <input
                  type="number"
                  min="1"
                  value={consumableRequestForm.quantityRequested}
                  onChange={(e) =>
                    setConsumableRequestForm((prev) => ({
                      ...prev,
                      quantityRequested: e.target.value,
                    }))
                  }
                  className={getFieldClass(false)}
                  placeholder="Ví dụ: 20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Lý do cần cấp phát
                </label>
                <textarea
                  rows={4}
                  value={consumableRequestForm.reason}
                  onChange={(e) =>
                    setConsumableRequestForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className={getFieldClass(false)}
                  placeholder="Ví dụ: chuẩn bị đầu kỳ học mới, bổ sung cho nhân sự mới, sắp hết vật tư tại phòng..."
                />
              </div>
            </div>

            <div className="mt-4 flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleCreateConsumableRequest}
                disabled={consumableRequestSubmitting}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showDisposalRequestModal && selectedExpiredLot && (
        <ModalOverlay zIndex={108} className="bg-slate-900/50">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Tạo yêu cầu tiêu huỷ vật tư hết hạn
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Chọn một hoặc nhiều lô cùng vật tư và nhập số lượng tiêu huỷ
                  theo từng lô.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDisposalRequestModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-slate-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-slate-200">
                <p>
                  <span className="font-semibold">Tên vật phẩm:</span>{" "}
                  {selectedExpiredLot.assetName}
                </p>
                <p>
                  <span className="font-semibold">Mã vật tư:</span>{" "}
                  {selectedExpiredLot.assetQaCode}
                </p>
                <p>
                  <span className="font-semibold">Số lô hết hạn đang có:</span>{" "}
                  {disposalRequestForm.items.length}
                </p>
              </div>
              <div className="flex justify-end">
                <ColumnVisibilityDropdown
                  columns={disposalModalLotColumnOptions}
                  visibleColumns={disposalModalLotColumns.visibleColumns}
                  selectedCount={disposalModalLotColumns.selectedCount}
                  allSelected={disposalModalLotColumns.allSelected}
                  onToggleColumn={(columnKey) =>
                    handleColumnToggleWithGuard(
                      columnKey,
                      disposalModalLotColumns.visibleColumns,
                      disposalModalLotColumns.selectedCount,
                      disposalModalLotColumns.toggleColumn,
                    )
                  }
                  onSelectAll={disposalModalLotColumns.selectAllColumns}
                  onResetDefault={disposalModalLotColumns.resetDefaultColumns}
                />
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/70">
                    <tr>
                      {disposalModalLotColumns.visibleColumns.selected && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          Chọn
                        </th>
                      )}
                      {disposalModalLotColumns.visibleColumns.lotCode && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          Lô hàng
                        </th>
                      )}
                      {disposalModalLotColumns.visibleColumns.receivedDate && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          Ngày nhập
                        </th>
                      )}
                      {disposalModalLotColumns.visibleColumns
                        .expirationDate && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          Hạn sử dụng
                        </th>
                      )}
                      {disposalModalLotColumns.visibleColumns
                        .quantityRemaining && (
                        <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                          Còn lại
                        </th>
                      )}
                      {disposalModalLotColumns.visibleColumns
                        .quantityRequested && (
                        <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                          Số lượng huỷ
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {disposalRequestForm.items.map((item) => (
                      <tr
                        key={item.receiptLotId}
                        className="border-t border-slate-200 dark:border-slate-800"
                      >
                        {disposalModalLotColumns.visibleColumns.selected && (
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={Boolean(item.selected)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setDisposalRequestForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((entry) =>
                                    entry.receiptLotId === item.receiptLotId
                                      ? {
                                          ...entry,
                                          selected: checked,
                                          quantityRequested: checked
                                            ? entry.quantityRequested ||
                                              String(
                                                entry.quantityRemaining || "",
                                              )
                                            : "",
                                        }
                                      : entry,
                                  ),
                                }));
                              }}
                            />
                          </td>
                        )}
                        {disposalModalLotColumns.visibleColumns.lotCode && (
                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            {item.lotCode}
                          </td>
                        )}
                        {disposalModalLotColumns.visibleColumns
                          .receivedDate && (
                          <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                            {formatDate(item.receivedDate)}
                          </td>
                        )}
                        {disposalModalLotColumns.visibleColumns
                          .expirationDate && (
                          <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                            {formatDate(item.expirationDate)}
                          </td>
                        )}
                        {disposalModalLotColumns.visibleColumns
                          .quantityRemaining && (
                          <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                            {item.formattedQuantityRemaining ||
                              formatConsumableQuantityText(item, {
                                quantityField: "quantityRemaining",
                                formattedField: "formattedQuantityRemaining",
                              })}
                          </td>
                        )}
                        {disposalModalLotColumns.visibleColumns
                          .quantityRequested && (
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="1"
                              max={item.quantityRemaining}
                              disabled={!item.selected}
                              value={item.quantityRequested}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setDisposalRequestForm((prev) => ({
                                  ...prev,
                                  items: prev.items.map((entry) =>
                                    entry.receiptLotId === item.receiptLotId
                                      ? {
                                          ...entry,
                                          quantityRequested: nextValue,
                                        }
                                      : entry,
                                  ),
                                }));
                              }}
                              className={`${getFieldClass(false)} text-right`}
                              placeholder="0"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Lý do cần tiêu huỷ
                </label>
                <textarea
                  rows={4}
                  value={disposalRequestForm.reason}
                  onChange={(e) =>
                    setDisposalRequestForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className={getFieldClass(false)}
                  placeholder="Do hết hạn sử dụng."
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCreateDisposalRequest}
                disabled={disposalRequestSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Gửi yêu cầu tiêu huỷ
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showConsumableDecisionModal && selectedConsumableRequest && (
        <ModalOverlay zIndex={108} className="bg-slate-900/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  {consumableDecisionAction === "APPROVE"
                    ? "Duyệt cấp phát phiếu yêu cầu"
                    : "Từ chối phiếu yêu cầu"}
                </h4>
                <p className="text-sm text-slate-500">
                  Phiếu #{selectedConsumableRequest.id} •{" "}
                  {selectedConsumableRequest.assetName} •{" "}
                  {selectedConsumableRequest.locationName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConsumableDecisionModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>
                  Số lượng yêu cầu:{" "}
                  {selectedConsumableRequest.formattedQuantityRequested ||
                    formatConsumableQuantityText(selectedConsumableRequest, {
                      quantityField: "quantityRequested",
                      formattedField: "formattedQuantityRequested",
                    })}
                </p>
                <p>
                  Kho xuất đề nghị:{" "}
                  {selectedConsumableRequest.sourceWarehouseLocationName ||
                    "Chưa chọn"}
                </p>
                <p>
                  Người tạo phiếu:{" "}
                  {selectedConsumableRequest.requestedByFullName ||
                    selectedConsumableRequest.requestedByUsername}
                </p>
                <p>Lý do: {selectedConsumableRequest.reason}</p>
              </div>
              {consumableDecisionAction === "APPROVE" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Kho xuất thực tế
                  </label>
                  <SearchableSelect
                    value={consumableDecisionSourceWarehouseLocationId}
                    onChange={(nextValue) =>
                      setConsumableDecisionSourceWarehouseLocationId(
                        String(nextValue || ""),
                      )
                    }
                    options={consumableDecisionWarehouseOptions}
                    getOptionValue={(location) => location.id}
                    getOptionLabel={(location) => location.roomName}
                    getOptionDescription={(location) =>
                      `${formatConsumableQuantityText({ ...selectedConsumableRequest, ...location }, { quantityField: "quantityRemaining", formattedField: "formattedQuantityRemaining" })} còn khả dụng${location.lotCount ? ` • ${location.lotCount} lô` : ""}`
                    }
                    placeholder="Gõ để tìm kho xuất"
                    emptyOptionLabel="Chọn kho xuất"
                    inputClassName={getFieldClass(false)}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {consumableDecisionAction === "APPROVE"
                    ? "Ghi chú duyệt"
                    : "Lý do từ chối"}
                </label>
                <textarea
                  rows={4}
                  value={consumableDecisionNote}
                  onChange={(e) => setConsumableDecisionNote(e.target.value)}
                  className={getFieldClass(false)}
                  placeholder={
                    consumableDecisionAction === "APPROVE"
                      ? "Ví dụ: duyệt cấp phát theo nhu cầu thực tế, ưu tiên sử dụng trong tuần này"
                      : "Nhập lý do từ chối để nhân viên quản lý cấp phát nhận được kết quả rõ ràng"
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmitConsumableDecision}
                disabled={consumableDecisionSubmitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  consumableDecisionAction === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {consumableDecisionAction === "APPROVE"
                  ? "Xác nhận duyệt cấp phát"
                  : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showDisposalDecisionModal && selectedDisposalRequest && (
        <ModalOverlay zIndex={109} className="bg-slate-900/50">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {disposalDecisionAction === "APPROVE"
                    ? "Duyệt tiêu huỷ vật tư hết hạn"
                    : "Từ chối yêu cầu tiêu huỷ"}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Phiếu #{selectedDisposalRequest.id} •{" "}
                  {selectedDisposalRequest.assetName} •{" "}
                  {selectedDisposalRequest.itemCount ||
                    selectedDisposalRequest.items?.length ||
                    1}{" "}
                  lô
                </p>
              </div>
              <button
                type="button"
                onClick={closeDisposalDecisionModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-sm text-slate-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-slate-200">
                <p>
                  Số lượng tiêu huỷ:{" "}
                  {selectedDisposalRequest.formattedQuantityRequested ||
                    formatConsumableQuantityText(selectedDisposalRequest, {
                      quantityField: "quantityRequested",
                      formattedField: "formattedQuantityRequested",
                    })}
                </p>
                <p>
                  Người đề nghị:{" "}
                  {selectedDisposalRequest.requestedByFullName ||
                    selectedDisposalRequest.requestedByUsername}
                </p>
                <p>Lý do: {selectedDisposalRequest.reason}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  Danh sách lô trong phiếu
                </div>
                <div className="flex justify-end px-3 pt-3">
                  <ColumnVisibilityDropdown
                    columns={disposalDecisionLotColumnOptions}
                    visibleColumns={disposalDecisionLotColumns.visibleColumns}
                    selectedCount={disposalDecisionLotColumns.selectedCount}
                    allSelected={disposalDecisionLotColumns.allSelected}
                    onToggleColumn={(columnKey) =>
                      handleColumnToggleWithGuard(
                        columnKey,
                        disposalDecisionLotColumns.visibleColumns,
                        disposalDecisionLotColumns.selectedCount,
                        disposalDecisionLotColumns.toggleColumn,
                      )
                    }
                    onSelectAll={disposalDecisionLotColumns.selectAllColumns}
                    onResetDefault={
                      disposalDecisionLotColumns.resetDefaultColumns
                    }
                  />
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/70">
                      <tr>
                        {disposalDecisionLotColumns.visibleColumns.lotCode && (
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                            Lô
                          </th>
                        )}
                        {disposalDecisionLotColumns.visibleColumns
                          .expirationDate && (
                          <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                            HSD
                          </th>
                        )}
                        {disposalDecisionLotColumns.visibleColumns
                          .quantityRequested && (
                          <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                            Số lượng huỷ
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedDisposalRequest.items || []).map((item) => (
                        <tr
                          key={item.id || item.receiptLotId}
                          className="border-t border-slate-200 dark:border-slate-800"
                        >
                          {disposalDecisionLotColumns.visibleColumns
                            .lotCode && (
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                              {item.lotCode || `Lô #${item.receiptLotId}`}
                            </td>
                          )}
                          {disposalDecisionLotColumns.visibleColumns
                            .expirationDate && (
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                              {formatDate(item.expirationDate)}
                            </td>
                          )}
                          {disposalDecisionLotColumns.visibleColumns
                            .quantityRequested && (
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                              {item.formattedQuantityRequested ||
                                formatConsumableQuantityText(item, {
                                  quantityField: "quantityRequested",
                                  formattedField: "formattedQuantityRequested",
                                })}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {disposalDecisionAction === "APPROVE" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Bạn có chắc chắn muốn tiêu huỷ các sản phẩm trên?
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {disposalDecisionAction === "APPROVE"
                    ? "Ghi chú duyệt"
                    : "Lý do từ chối"}
                </label>
                <textarea
                  rows={4}
                  value={disposalDecisionNote}
                  onChange={(e) => setDisposalDecisionNote(e.target.value)}
                  className={getFieldClass(false)}
                  placeholder={
                    disposalDecisionAction === "APPROVE"
                      ? "Ví dụ: tiêu huỷ theo biên bản do lô đã quá hạn sử dụng."
                      : "Nhập lý do từ chối để người đề nghị biết cách xử lý tiếp."
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmitDisposalDecision}
                disabled={disposalDecisionSubmitting}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  disposalDecisionAction === "APPROVE"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-slate-700 hover:bg-slate-800"
                }`}
              >
                {disposalDecisionAction === "APPROVE"
                  ? "Có, chắc chắn"
                  : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {selectedDisposalHistoryRequest && (
        <ModalOverlay zIndex={108} className="bg-slate-900/50">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Chi tiết phiếu tiêu huỷ #{selectedDisposalHistoryRequest.id}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedDisposalHistoryRequest.assetName} •{" "}
                  {selectedDisposalHistoryRequest.formattedQuantityRequested ||
                    formatConsumableQuantityText(
                      selectedDisposalHistoryRequest,
                      {
                        quantityField: "quantityRequested",
                        formattedField: "formattedQuantityRequested",
                      },
                    )}{" "}
                  •{" "}
                  {selectedDisposalHistoryRequest.itemCount ||
                    selectedDisposalHistoryRequest.items?.length ||
                    1}{" "}
                  lô
                </p>
              </div>
              <button
                type="button"
                onClick={closeDisposalHistoryDetailModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <p>
                  <span className="font-semibold">Người đề nghị:</span>{" "}
                  {selectedDisposalHistoryRequest.requestedByFullName ||
                    selectedDisposalHistoryRequest.requestedByUsername}
                </p>
                <p>
                  <span className="font-semibold">Thời gian tạo:</span>{" "}
                  {formatDateTime(selectedDisposalHistoryRequest.createdAt)}
                </p>
                <p>
                  <span className="font-semibold">Lý do:</span>{" "}
                  {selectedDisposalHistoryRequest.reason}
                </p>
                {selectedDisposalHistoryRequest.resolvedAt && (
                  <p>
                    <span className="font-semibold">Xử lý:</span>{" "}
                    {formatDateTime(selectedDisposalHistoryRequest.resolvedAt)}{" "}
                    bởi{" "}
                    {selectedDisposalHistoryRequest.resolvedByFullName ||
                      selectedDisposalHistoryRequest.resolvedByUsername}
                  </p>
                )}
                {selectedDisposalHistoryRequest.decisionNote && (
                  <p>
                    <span className="font-semibold">Ghi chú xử lý:</span>{" "}
                    {selectedDisposalHistoryRequest.decisionNote}
                  </p>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-end p-3 pb-0">
                  <ColumnVisibilityDropdown
                    columns={disposalHistoryLotColumnOptions}
                    visibleColumns={disposalHistoryLotColumns.visibleColumns}
                    selectedCount={disposalHistoryLotColumns.selectedCount}
                    allSelected={disposalHistoryLotColumns.allSelected}
                    onToggleColumn={(columnKey) =>
                      handleColumnToggleWithGuard(
                        columnKey,
                        disposalHistoryLotColumns.visibleColumns,
                        disposalHistoryLotColumns.selectedCount,
                        disposalHistoryLotColumns.toggleColumn,
                      )
                    }
                    onSelectAll={disposalHistoryLotColumns.selectAllColumns}
                    onResetDefault={
                      disposalHistoryLotColumns.resetDefaultColumns
                    }
                  />
                </div>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/70">
                    <tr>
                      {disposalHistoryLotColumns.visibleColumns.lotCode && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          Lô
                        </th>
                      )}
                      {disposalHistoryLotColumns.visibleColumns
                        .receivedDate && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          Ngày nhập
                        </th>
                      )}
                      {disposalHistoryLotColumns.visibleColumns
                        .expirationDate && (
                        <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                          HSD
                        </th>
                      )}
                      {disposalHistoryLotColumns.visibleColumns
                        .quantityRequested && (
                        <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                          Số lượng huỷ
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDisposalHistoryRequest.items || []).map(
                      (lotItem) => (
                        <tr
                          key={lotItem.id || lotItem.receiptLotId}
                          className="border-t border-slate-200 dark:border-slate-800"
                        >
                          {disposalHistoryLotColumns.visibleColumns.lotCode && (
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                              {lotItem.lotCode || `Lô #${lotItem.receiptLotId}`}
                            </td>
                          )}
                          {disposalHistoryLotColumns.visibleColumns
                            .receivedDate && (
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                              {formatDate(lotItem.receivedDate)}
                            </td>
                          )}
                          {disposalHistoryLotColumns.visibleColumns
                            .expirationDate && (
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                              {formatDate(lotItem.expirationDate)}
                            </td>
                          )}
                          {disposalHistoryLotColumns.visibleColumns
                            .quantityRequested && (
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">
                              {lotItem.formattedQuantityRequested ||
                                formatConsumableQuantityText(lotItem, {
                                  quantityField: "quantityRequested",
                                  formattedField: "formattedQuantityRequested",
                                })}
                            </td>
                          )}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showStockAdjustModal && selectedStockRecord && (
        <ModalOverlay zIndex={107} className="bg-slate-900/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-800">
                  Cập nhật số lượng còn lại
                </h4>
                <p className="text-sm text-slate-500">
                  {selectedStockRecord.assetName} tại{" "}
                  {selectedStockRecord.locationName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeStockAdjustModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>
                  Tổng đã cấp:{" "}
                  {selectedStockRecord.formattedQuantityIssued ||
                    formatConsumableQuantityText(selectedStockRecord, {
                      quantityField: "quantityIssued",
                      formattedField: "formattedQuantityIssued",
                    })}
                </p>
                <p>
                  Số lượng còn lại hiện tại:{" "}
                  {selectedStockRecord.formattedQuantityRemaining ||
                    formatConsumableQuantityText(selectedStockRecord, {
                      quantityField: "quantityRemaining",
                      formattedField: "formattedQuantityRemaining",
                    })}
                </p>
                <p>
                  Đã sử dụng:{" "}
                  {selectedStockRecord.formattedQuantityConsumed ||
                    formatConsumableQuantityText(selectedStockRecord, {
                      quantityField: "quantityConsumed",
                      formattedField: "formattedQuantityConsumed",
                    })}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Số lượng còn lại mới
                </label>
                <input
                  type="number"
                  min="0"
                  value={stockAdjustForm.quantityRemaining}
                  onChange={(e) =>
                    setStockAdjustForm((prev) => ({
                      ...prev,
                      quantityRemaining: e.target.value,
                    }))
                  }
                  className={getFieldClass(false)}
                  placeholder={`Ví dụ: 15 ${getConsumableRetailUnit(selectedStockRecord)}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Ghi chú cập nhật
                </label>
                <textarea
                  rows={3}
                  value={stockAdjustForm.note}
                  onChange={(e) =>
                    setStockAdjustForm((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                  className={getFieldClass(false)}
                  placeholder="Ví dụ: đã sử dụng trong tháng, còn lại sau kiểm tra thực tế"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleUpdateStockRemaining}
                disabled={stockAdjustSubmitting}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Lưu số lượng còn lại
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showBulkQrPreview && (
        <ModalOverlay zIndex={100} className="bg-slate-900/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Preview in QR đã chọn
                </h4>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Sẽ in {selectedQrAssets.length} tem QR theo khổ A4, bố cục 2
                  cột.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelQrSelection}
                  disabled={bulkQrPrinting}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Bỏ chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkQrPreview(false)}
                  disabled={bulkQrPrinting}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Mã QA</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Tên thiết bị
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedQrAssets.map((asset) => (
                    <tr
                      key={asset.qaCode}
                      className="bg-white dark:bg-slate-900"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                        {asset.qaCode}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {asset.name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleQrSelection(asset)}
                          disabled={bulkQrPrinting}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400"
                        >
                          Bỏ chọn
                        </button>
                      </td>
                    </tr>
                  ))}
                  {selectedQrAssets.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-sm text-slate-500"
                      >
                        Chưa chọn tài sản nào để in QR.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkQrPreview(false)}
                disabled={bulkQrPrinting}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePrintSelectedQrs}
                disabled={bulkQrPrinting || selectedQrAssets.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer size={15} />
                {bulkQrPrinting
                  ? "Đang tải QR..."
                  : `In ${selectedQrAssets.length} QR`}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showQrModal && (
        <ModalOverlay zIndex={100} className="bg-slate-900/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-base font-semibold text-slate-800">
                Mã QR thiết bị {qrModalQaCode}
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintCurrentQr}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Printer size={13} />
                  In mã QR
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCurrentQr}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <Download size={13} />
                  Tải PNG
                </button>
                <button
                  type="button"
                  onClick={handleCloseQrModal}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={qrModalImage}
                alt={`QR ${qrModalQaCode}`}
                className="h-[300px] w-[300px] rounded border border-slate-200"
              />
            </div>
            {qrModalAssetName && (
              <p className="mt-3 text-center text-sm font-medium text-slate-700">
                {qrModalAssetName}
              </p>
            )}
          </div>
        </ModalOverlay>
      )}

      {showSupplierCreateModal && (
        <ModalOverlay zIndex={110} className="bg-slate-900/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                Thêm mới nhà cung cấp
              </h4>
              <button
                type="button"
                onClick={closeSupplierCreateModal}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tên nhà cung cấp
                </label>
                <input
                  value={supplierForm.name}
                  onChange={(e) => {
                    setSupplierForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }));
                    setSupplierFormErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="Ví dụ: Công ty thiết bị giáo dục ABC"
                  className={getFieldClass(Boolean(supplierFormErrors.name))}
                />
                {supplierFormErrors.name && (
                  <p className="mt-1 text-xs text-red-600">
                    {supplierFormErrors.name}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Số điện thoại
                </label>
                <input
                  value={supplierForm.phoneNumber}
                  onChange={(e) => {
                    setSupplierForm((prev) => ({
                      ...prev,
                      phoneNumber: e.target.value,
                    }));
                    setSupplierFormErrors((prev) => ({
                      ...prev,
                      phoneNumber: "",
                    }));
                  }}
                  placeholder="Ví dụ: 0901234567"
                  className={getFieldClass(
                    Boolean(supplierFormErrors.phoneNumber),
                  )}
                />
                {supplierFormErrors.phoneNumber && (
                  <p className="mt-1 text-xs text-red-600">
                    {supplierFormErrors.phoneNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Địa chỉ
                </label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) => {
                    setSupplierForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }));
                    setSupplierFormErrors((prev) => ({ ...prev, address: "" }));
                  }}
                  placeholder="Nhập địa chỉ nhà cung cấp"
                  rows={3}
                  className={getFieldClass(Boolean(supplierFormErrors.address))}
                />
                {supplierFormErrors.address && (
                  <p className="mt-1 text-xs text-red-600">
                    {supplierFormErrors.address}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCreateSupplierInline}
                disabled={creatingSupplier}
                className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
              >
                Lưu nhà cung cấp
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showSpecsModal && selectedSpecsAsset && (
        <ModalOverlay zIndex={100} className="bg-slate-900/50">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                {getSpecLabelByTrackingMode(selectedSpecsAsset.trackingMode)} -{" "}
                {selectedSpecsAsset.name}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowSpecsModal(false);
                  setSelectedSpecsAsset(null);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="space-y-2">
              {selectedSpecsEntries.map((entry) => (
                <div
                  key={`${entry.name}-${entry.value}`}
                  className="grid grid-cols-[180px_1fr] gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-slate-700">{entry.name}</p>
                  <p className="text-slate-600">{entry.value}</p>
                </div>
              ))}
              {selectedSpecsEntries.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {isConsumableMode(selectedSpecsAsset.trackingMode)
                    ? "Vật tư này chưa có thông số."
                    : "Thiết bị này chưa có đặc tính kỹ thuật."}
                </p>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {showOriginModal && selectedOriginAsset && (
        <ModalOverlay zIndex={100} className="bg-slate-900/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">
                Nguồn gốc tài sản - {selectedOriginAsset.name}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowOriginModal(false);
                  setSelectedOriginAsset(null);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Kiểu theo dõi:</span>{" "}
                {getTrackingModeLabel(selectedOriginAsset.trackingMode)}
              </p>
              {!isConsumableMode(selectedOriginAsset.trackingMode) && (
                <>
                  <p>
                    <span className="font-semibold">Tình trạng kỹ thuật:</span>{" "}
                    {getTechnicalStatusLabel(
                      selectedOriginAsset.technicalStatus ||
                        selectedOriginAsset.status,
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Trạng thái sử dụng:</span>{" "}
                    {getUsageStatusLabel(selectedOriginAsset.usageStatus)}
                  </p>
                  <p>
                    <span className="font-semibold">Trạng thái hiển thị:</span>{" "}
                    {getAssetStatusLabel(selectedOriginAsset.status)}
                  </p>
                </>
              )}
              <p>
                <span className="font-semibold">Ngày mua:</span>{" "}
                {formatDate(selectedOriginAsset.purchaseDate)}
              </p>
              <p>
                <span className="font-semibold">Giá mua:</span>{" "}
                {formatCurrency(selectedOriginAsset.purchasePrice)}
              </p>
              {isConsumableMode(selectedOriginAsset.trackingMode) && (
                <>
                  <p>
                    <span className="font-semibold">Số lượng tồn:</span>{" "}
                    {selectedOriginAsset.formattedQuantityOnHand ||
                      formatConsumableQuantityText(selectedOriginAsset)}
                  </p>
                  <p>
                    <span className="font-semibold">Ngưỡng cảnh báo tồn:</span>{" "}
                    {selectedOriginAsset.formattedMinimumStock ||
                      formatConsumableQuantityText(selectedOriginAsset, {
                        quantityField: "minimumStock",
                        formattedField: "formattedMinimumStock",
                      })}
                  </p>
                  <p>
                    <span className="font-semibold">Đơn vị lẻ:</span>{" "}
                    {getConsumableRetailUnit(selectedOriginAsset)}
                  </p>
                  <p>
                    <span className="font-semibold">Đơn vị sỉ:</span>{" "}
                    {selectedOriginAsset.wholesaleUnit ||
                      getConsumableRetailUnit(selectedOriginAsset)}
                  </p>
                  <p>
                    <span className="font-semibold">Quy đổi:</span> 1{" "}
                    {selectedOriginAsset.wholesaleUnit ||
                      getConsumableRetailUnit(selectedOriginAsset)}{" "}
                    = {selectedOriginAsset.wholesaleToRetailFactor || 1}{" "}
                    {getConsumableRetailUnit(selectedOriginAsset)}
                  </p>
                  <p>
                    <span className="font-semibold">Quản lý hạn sử dụng:</span>{" "}
                    {selectedOriginAsset.expiryTrackingEnabled ? "Có" : "Không"}
                  </p>
                  <p>
                    <span className="font-semibold">Hạn sử dụng:</span>{" "}
                    {selectedOriginAsset.expiryTrackingEnabled
                      ? formatDate(selectedOriginAsset.expirationDate)
                      : "Không áp dụng"}
                  </p>
                </>
              )}
              {!isConsumableMode(selectedOriginAsset.trackingMode) && (
                <p>
                  <span className="font-semibold">Hạn bảo hành:</span>{" "}
                  {formatDate(selectedOriginAsset.warrantyExpirationDate)}
                </p>
              )}
              <p>
                <span className="font-semibold">Nhà cung cấp:</span>{" "}
                {selectedOriginAsset.supplierName || "Chưa cập nhật"}
              </p>
              <p>
                <span className="font-semibold">Số điện thoại NCC:</span>{" "}
                {selectedOriginAsset.supplierPhoneNumber || "Chưa cập nhật"}
              </p>
              <p>
                <span className="font-semibold">Địa chỉ NCC:</span>{" "}
                {selectedOriginAsset.supplierAddress || "Chưa cập nhật"}
              </p>
            </div>
            {isConsumableMode(selectedOriginAsset.trackingMode) && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800">
                      Chi tiết các lô nhập
                    </h5>
                    <p className="text-xs text-slate-500">
                      Hiển thị từng lô để theo dõi số lượng còn lại và hạn sử
                      dụng riêng biệt.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {(selectedOriginAsset.receiptLots || []).length} lô
                  </span>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {(selectedOriginAsset.receiptLots || []).length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có dữ liệu lô nhập cho vật tư này.
                    </p>
                  )}
                  {(selectedOriginAsset.receiptLots || []).map((lot) => (
                    <div
                      key={lot.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-800">
                          {lot.lotCode || `Lô #${lot.id}`}
                        </p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(getConsumableExpiryState({ ...lot, expiryTrackingEnabled: selectedOriginAsset.expiryTrackingEnabled }).tone)}`}
                        >
                          {
                            getConsumableExpiryState({
                              ...lot,
                              expiryTrackingEnabled:
                                selectedOriginAsset.expiryTrackingEnabled,
                            }).label
                          }
                        </span>
                      </div>
                      <p className="mt-1">
                        Số lượng:{" "}
                        {lot.formattedQuantityRemaining ||
                          formatConsumableQuantityText(
                            { ...selectedOriginAsset, ...lot },
                            {
                              quantityField: "quantityRemaining",
                              formattedField: "formattedQuantityRemaining",
                            },
                          )}{" "}
                        /{" "}
                        {lot.formattedQuantityReceived ||
                          formatConsumableQuantityText(
                            { ...selectedOriginAsset, ...lot },
                            {
                              quantityField: "quantityReceived",
                              formattedField: "formattedQuantityReceived",
                            },
                          )}
                      </p>
                      <p>
                        Ngày nhập: {formatDate(lot.receivedDate)} | Hạn dùng:{" "}
                        {
                          getConsumableExpiryState({
                            ...lot,
                            expiryTrackingEnabled:
                              selectedOriginAsset.expiryTrackingEnabled,
                          }).dateLabel
                        }
                      </p>
                      <p>
                        Đơn giá lô: {formatCurrency(lot.unitPrice)} | NCC:{" "}
                        {lot.supplierName || "Chưa cập nhật"}
                      </p>
                      {lot.note && (
                        <p className="mt-1 text-slate-500">{lot.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      <AssetRepairTimelineModal
        open={showTimelineModal}
        onClose={() => {
          setShowTimelineModal(false);
          setTimelineAsset(null);
        }}
        assetQaCode={timelineAsset?.qaCode}
        assetName={timelineAsset?.name}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        tone={confirmDialog.tone}
        busy={confirmDialog.busy}
        onConfirm={handleConfirmDialogAccept}
        onClose={closeConfirmDialog}
      />

      {showImportModal && (
        <ModalOverlay zIndex={100} className="bg-black/50">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Nhập tài sản từ Excel
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Chọn file Excel (.xlsx)
                  </label>
                  <button
                    type="button"
                    onClick={handleImportTemplate}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download size={13} />
                    Tải file mẫu
                  </button>
                </div>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImportFile(file);
                    setImportPreview(null);
                    void handleImportPreview(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  disabled={importPreviewing}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400"
                >
                  <Upload size={15} />
                  {importFile ? importFile.name : "Chọn file..."}
                </button>
                {importPreviewing && (
                  <p className="mt-2 text-xs text-slate-500">
                    Đang phân tích file...
                  </p>
                )}
              </div>

              {importPreview && (
                <div>
                  <div className="mb-3 flex items-center gap-4 text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Tổng: {importPreview.totalRows} dòng
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ Hợp lệ: {importPreview.validRows}
                    </span>
                    {importPreview.errorRows > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        ✗ Lỗi: {importPreview.errorRows}
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Dòng</th>
                          <th className="px-3 py-2">Kiểu</th>
                          <th className="px-3 py-2">Tên</th>
                          <th className="px-3 py-2">Loại</th>
                          <th className="px-3 py-2">Phòng</th>
                          <th className="px-3 py-2">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {importPreview.rows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={
                              row.valid
                                ? "bg-white dark:bg-slate-950"
                                : "bg-red-50 dark:bg-red-500/5"
                            }
                          >
                            <td className="px-3 py-2 text-slate-500">
                              {row.rowNumber}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                                  row.trackingMode?.toUpperCase() ===
                                  "CONSUMABLE"
                                    ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                                }`}
                              >
                                {row.trackingMode?.toUpperCase() ===
                                "CONSUMABLE"
                                  ? "Tiêu hao"
                                  : "Cố định"}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100 max-w-[160px] truncate">
                              {row.name || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {row.categoryName || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {row.locationName || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.valid ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  ✓ Hợp lệ
                                </span>
                              ) : (
                                <div className="text-red-600 dark:text-red-400">
                                  {row.errors?.map((err, i) => (
                                    <p
                                      key={i}
                                      className="text-xs leading-tight"
                                    >
                                      ✗ {err}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleImportCommit}
                disabled={
                  !importPreview ||
                  importPreview.validRows === 0 ||
                  importCommitting
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importCommitting
                  ? "Đang nhập..."
                  : `Nhập ${importPreview?.validRows ?? 0} tài sản hợp lệ`}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

export default AssetManagement;
