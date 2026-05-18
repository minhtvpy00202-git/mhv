const PHONE_VN_REGEX = /^0\d{9}$/
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/
const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH']

function isBlank(value) {
  return !String(value || '').trim()
}

function isPositiveNumber(value) {
  const numericValue = Number(value)
  return !Number.isNaN(numericValue) && numericValue > 0
}

function isPastOrToday(dateValue) {
  if (!dateValue) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const inputDate = new Date(dateValue)
  inputDate.setHours(0, 0, 0, 0)
  return inputDate.getTime() <= today.getTime()
}

export function validateAssetForm(form) {
  const errors = {}
  const normalizedName = String(form?.name || '').trim()

  if (normalizedName.length < 2 || normalizedName.length > 150) {
    errors.name = 'Tên thiết bị phải từ 2 đến 150 ký tự.'
  }
  if (!isPositiveNumber(form?.categoryId)) {
    errors.categoryId = 'Vui lòng chọn loại thiết bị hợp lệ.'
  }
  if (!isPositiveNumber(form?.locationId)) {
    errors.locationId = 'Vui lòng chọn phòng gốc hợp lệ.'
  }
  if (!isPositiveNumber(form?.supplierId)) {
    errors.supplierId = 'Vui lòng chọn nhà cung cấp từ danh sách.'
  }
  if (!isPositiveNumber(form?.purchasePrice)) {
    errors.purchasePrice = 'Giá mua phải lớn hơn 0.'
  }
  if (!form?.purchaseDate) {
    errors.purchaseDate = 'Vui lòng chọn ngày mua.'
  } else if (!isPastOrToday(form.purchaseDate)) {
    errors.purchaseDate = 'Ngày mua không được ở tương lai.'
  }
  if (!form?.warrantyExpirationDate) {
    errors.warrantyExpirationDate = 'Vui lòng chọn hạn bảo hành.'
  } else if (form.purchaseDate && new Date(form.warrantyExpirationDate) < new Date(form.purchaseDate)) {
    errors.warrantyExpirationDate = 'Hạn bảo hành phải sau hoặc bằng ngày mua.'
  }

  const specEntries = Array.isArray(form?.specEntries) ? form.specEntries : []
  if (specEntries.length > 50) {
    errors.specEntries = 'Không được nhập quá 50 đặc tính kỹ thuật.'
  } else {
    const hasInvalidSpec = specEntries.some((entry) => {
      const name = String(entry?.name || '').trim()
      const value = String(entry?.value || '').trim()
      if (!name && !value) return false
      if (!name || !value) return true
      if (name.length > 100 || value.length > 200) return true
      return false
    })
    if (hasInvalidSpec) {
      errors.specEntries = 'Mỗi đặc tính phải có đủ tên và giá trị; tên tối đa 100 ký tự, giá trị tối đa 200 ký tự.'
    }
  }

  return errors
}

export function validateSupplierForm(form) {
  const errors = {}
  const name = String(form?.name || '').trim()
  const address = String(form?.address || '').trim()
  const phoneNumber = String(form?.phoneNumber || '').trim()

  if (name.length < 2 || name.length > 150) {
    errors.name = 'Tên nhà cung cấp phải từ 2 đến 150 ký tự.'
  }
  if (address.length < 5 || address.length > 255) {
    errors.address = 'Địa chỉ phải từ 5 đến 255 ký tự.'
  }
  if (!PHONE_VN_REGEX.test(phoneNumber)) {
    errors.phoneNumber = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.'
  }

  return errors
}

export function validateCategoryForm(form) {
  const errors = {}
  const name = String(form?.name || '').trim()
  const specTemplates = Array.isArray(form?.specTemplates) ? form.specTemplates : []

  if (name.length < 2 || name.length > 50) {
    errors.name = 'Tên loại thiết bị phải từ 2 đến 50 ký tự.'
  }
  if (!isPositiveNumber(form?.techTypeId)) {
    errors.techTypeId = 'Vui lòng chọn nhóm kỹ thuật hợp lệ.'
  }
  if (specTemplates.length > 30) {
    errors.specTemplates = 'Không được nhập quá 30 template đặc tính kỹ thuật.'
  } else {
    const normalized = specTemplates
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    const hasTooLong = normalized.some((item) => item.length > 100)
    const uniqueCount = new Set(normalized.map((item) => item.toLowerCase())).size
    if (hasTooLong) {
      errors.specTemplates = 'Mỗi template đặc tính kỹ thuật tối đa 100 ký tự.'
    } else if (uniqueCount !== normalized.length) {
      errors.specTemplates = 'Template đặc tính kỹ thuật không được trùng nhau.'
    }
  }

  return errors
}

export function validateLoginForm(form) {
  const errors = {}
  const username = String(form?.username || '').trim()
  const password = String(form?.password || '')

  if (username.length < 4 || username.length > 50 || !USERNAME_REGEX.test(username)) {
    errors.username = 'Username phải từ 4 đến 50 ký tự và chỉ gồm chữ, số, dấu gạch dưới.'
  }
  if (password.length < 6 || password.length > 100 || isBlank(password)) {
    errors.password = 'Password phải từ 6 đến 100 ký tự.'
  }

  return errors
}

export function validateMaintenanceTicketForm(form) {
  const errors = {}
  const assetQaCode = String(form?.assetQaCode || '').trim()
  const description = String(form?.description || '').trim()
  const priority = String(form?.priority || '')
  const imageFile = form?.imageFile || null

  if (!assetQaCode || assetQaCode.length > 20) {
    errors.assetQaCode = 'Mã QA thiết bị không hợp lệ.'
  }
  if (description.length < 10 || description.length > 1000) {
    errors.description = 'Mô tả sự cố phải từ 10 đến 1000 ký tự.'
  }
  if (!PRIORITY_VALUES.includes(priority)) {
    errors.priority = 'Mức độ ưu tiên không hợp lệ.'
  }
  if (imageFile) {
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!acceptedTypes.includes(imageFile.type)) {
      errors.imageFile = 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'
    } else if (imageFile.size > 10 * 1024 * 1024) {
      errors.imageFile = 'Ảnh đính kèm không được vượt quá 10MB.'
    }
  }

  return errors
}

export function hasValidationErrors(errors) {
  return Object.keys(errors || {}).length > 0
}
