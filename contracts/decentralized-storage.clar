(define-map file-storage
  { file-id: (string-ascii 64) }
  {
    owner: principal,
    size: uint,
    storage-provider: principal,
    encrypted-location: (string-ascii 256),
    last-payment-height: uint
  }
)

(define-map storage-providers
  { provider: principal }
  { available-space: uint, price-per-block: uint }
)

(define-data-var payment-interval uint u144) ;; Approximately 1 day (assuming 10-minute block times)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-file-owner (err u101))
(define-constant err-file-not-found (err u102))
(define-constant err-insufficient-funds (err u103))
(define-constant err-provider-not-found (err u104))

(define-public (register-storage-provider (available-space uint) (price-per-block uint))
  (ok (map-set storage-providers
    { provider: tx-sender }
    { available-space: available-space, price-per-block: price-per-block }
  ))
)

(define-public (store-file (file-id (string-ascii 64)) (size uint) (storage-provider principal) (encrypted-location (string-ascii 256)))
  (let (
    (provider (unwrap! (map-get? storage-providers { provider: storage-provider }) err-provider-not-found))
    (payment-amount (* size (get price-per-block provider)))
  )
    (asserts! (>= (get available-space provider) size) err-insufficient-funds)
    (map-set file-storage
      { file-id: file-id }
      {
        owner: tx-sender,
        size: size,
        storage-provider: storage-provider,
        encrypted-location: encrypted-location,
        last-payment-height: block-height
      }
    )
    (map-set storage-providers
      { provider: storage-provider }
      (merge provider { available-space: (- (get available-space provider) size) })
    )
    (ok true)
  )
)

(define-public (retrieve-file (file-id (string-ascii 64)))
  (let ((file (unwrap! (map-get? file-storage { file-id: file-id }) err-file-not-found)))
    (asserts! (is-eq (get owner file) tx-sender) err-not-file-owner)
    (ok (get encrypted-location file))
  )
)

(define-public (delete-file (file-id (string-ascii 64)))
  (let (
    (file (unwrap! (map-get? file-storage { file-id: file-id }) err-file-not-found))
    (provider (unwrap! (map-get? storage-providers { provider: (get storage-provider file) }) err-provider-not-found))
  )
    (asserts! (is-eq (get owner file) tx-sender) err-not-file-owner)
    (map-delete file-storage { file-id: file-id })
    (map-set storage-providers
      { provider: (get storage-provider file) }
      (merge provider { available-space: (+ (get available-space provider) (get size file)) })
    )
    (ok true)
  )
)

(define-public (process-payment (file-id (string-ascii 64)))
  (let (
    (file (unwrap! (map-get? file-storage { file-id: file-id }) err-file-not-found))
    (provider (unwrap! (map-get? storage-providers { provider: (get storage-provider file) }) err-provider-not-found))
    (blocks-since-last-payment (- block-height (get last-payment-height file)))
    (payment-amount (* (get size file) (get price-per-block provider) blocks-since-last-payment))
  )
    (asserts! (>= blocks-since-last-payment (var-get payment-interval)) err-owner-only)
    (ok (map-set file-storage
      { file-id: file-id }
      (merge file { last-payment-height: block-height })
    ))
  )
)

(define-read-only (get-file-info (file-id (string-ascii 64)))
  (ok (unwrap! (map-get? file-storage { file-id: file-id }) err-file-not-found))
)

(define-read-only (get-storage-provider-info (provider principal))
  (ok (unwrap! (map-get? storage-providers { provider: provider }) err-provider-not-found))
)

(define-public (set-payment-interval (new-interval uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set payment-interval new-interval))
  )
)

