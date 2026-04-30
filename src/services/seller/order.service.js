const prisma = require('../../config/database');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a Date range object for Prisma from a preset string or custom range.
 * @param {string} preset  — 'today', 'tomorrow', 'next_3_days'
 * @param {string} startDate — ISO string
 * @param {string} endDate   — ISO string
 */
const buildDateFilter = (preset, startDate, endDate) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday   = new Date(startOfToday.getTime() + 86400000 - 1);

    if (preset) {
        switch (preset.toLowerCase()) {
            case 'today':
                return { gte: startOfToday, lte: endOfToday };
            case 'tomorrow': {
                const start = new Date(startOfToday.getTime() + 86400000);
                const end   = new Date(start.getTime() + 86400000 - 1);
                return { gte: start, lte: end };
            }
            case 'next_3_days': {
                const end3 = new Date(startOfToday.getTime() + 3 * 86400000 - 1);
                return { gte: startOfToday, lte: end3 };
            }
        }
    }

    if (startDate || endDate) {
        const filter = {};
        if (startDate) filter.gte = new Date(startDate);
        if (endDate)   filter.lte = new Date(endDate);
        return filter;
    }

    return null;
};

// ─── Map frontend tab to DB enum ─────────────────────────────────────────────

const TAB_TO_STATUS = {
    on_hold:       'ON_HOLD',
    pending:       'PENDING',
    ready_to_ship: 'READY_TO_SHIP',
    shipped:       'SHIPPED',
    cancelled:     'CANCELLED',
};

// ─── Main listing function ────────────────────────────────────────────────────

/**
 * List all order items belonging to products owned by this seller,
 * with full Meesho-style filters.
 *
 * Filters:
 *  - tab              : on_hold | pending | ready_to_ship | shipped | cancelled
 *  - slaStatus        : breached | breaching_soon | others
 *  - labelDownloaded  : 'true' | 'false'
 *  - dispatchPreset   : today | tomorrow | next_3_days
 *  - dispatchStart/dispatchEnd : custom date range for dispatch SLA
 *  - orderStart/orderEnd       : custom date range for order creation
 *  - skuId            : search term
 *  - sortBy           : sku_id | delivery_partner | dispatch_date (default: dispatch_date)
 *  - page             : page number (default 1)
 *  - limit            : items per page (default 20)
 */
const getSellerOrders = async (sellerId, filters = {}) => {
    const {
        tab = 'pending',
        slaStatus,
        labelDownloaded,
        dispatchPreset,
        dispatchStart,
        dispatchEnd,
        orderStart,
        orderEnd,
        skuId,
        sortBy = 'dispatch_date',
        page = 1,
        limit = 20,
    } = filters;

    // 1. Base where — only items from this seller's products
    const where = {
        product: {
            catalog: { sellerId },
        },
    };

    // 2. Tab filter (OrderItemStatus)
    const targetStatus = TAB_TO_STATUS[tab?.toLowerCase()];
    if (targetStatus) where.status = targetStatus;

    // 3. SLA Status filter
    if (slaStatus && targetStatus !== 'SHIPPED' && targetStatus !== 'CANCELLED') {
        const now = new Date();
        const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // within 24h
        switch (slaStatus.toLowerCase()) {
            case 'breached':
                where.dispatchSla = { lt: now };
                break;
            case 'breaching_soon':
                where.dispatchSla = { gte: now, lte: soon };
                break;
            case 'others':
                where.dispatchSla = { gt: soon };
                break;
        }
    }

    // 4. Label Downloaded filter
    if (labelDownloaded !== undefined && labelDownloaded !== '') {
        where.labelDownloaded = labelDownloaded === 'true' || labelDownloaded === true;
    }

    // 5. Dispatch SLA Date range
    const dispatchFilter = buildDateFilter(dispatchPreset, dispatchStart, dispatchEnd);
    if (dispatchFilter) where.dispatchSla = dispatchFilter;

    // 6. Order creation date range
    const orderDateFilter = buildDateFilter(null, orderStart, orderEnd);
    if (orderDateFilter) where.createdAt = orderDateFilter;

    // 7. SKU search
    if (skuId) {
        where.product = {
            ...where.product,
            sku: { contains: skuId, mode: 'insensitive' },
        };
    }

    // 8. Sorting
    let orderBy;
    switch (sortBy.toLowerCase()) {
        case 'sku_id':
            orderBy = { product: { sku: 'asc' } };
            break;
        case 'delivery_partner':
            orderBy = { deliveryPartner: 'asc' };
            break;
        case 'dispatch_date':
        default:
            orderBy = { dispatchSla: 'asc' };
            break;
    }

    // 9. Pagination
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // 10. Counts per tab (always for all statuses for this seller)
    const countWhere = { product: { catalog: { sellerId } } };

    const [items, total, onHoldCount, pendingCount, readyToShipCount, shippedCount, cancelledCount] =
        await Promise.all([
            prisma.orderItem.findMany({
                where,
                orderBy,
                skip,
                take,
                select: {
                    id: true,
                    quantity: true,
                    price: true,
                    mrp: true,
                    gstAmount: true,
                    tcsAmount: true,
                    tdsAmount: true,
                    commissionRate: true,
                    commissionAmount: true,
                    status: true,
                    dispatchSla: true,
                    labelDownloaded: true,
                    deliveryPartner: true,
                    trackingId: true,
                    createdAt: true,
                    updatedAt: true,
                    order: {
                        select: {
                            id: true,
                            grandTotal: true,
                            createdAt: true,
                            user: { select: { name: true, mobileNumber: true } },
                        },
                    },
                    product: {
                        select: {
                            id: true,
                            productName: true,
                            sku: true,
                            catalog: {
                                select: {
                                    brandName: true,
                                    category: { select: { name: true } },
                                },
                            },
                            attributeValues: {
                                include: { attribute: { select: { name: true } } },
                            },
                            images: {
                                where: { imageType: 'FRONT' },
                                take: 1,
                                select: { url: true },
                            },
                        },
                    },
                },
            }),
            prisma.orderItem.count({ where }),
            prisma.orderItem.count({ where: { ...countWhere, status: 'ON_HOLD' } }),
            prisma.orderItem.count({ where: { ...countWhere, status: 'PENDING' } }),
            prisma.orderItem.count({ where: { ...countWhere, status: 'READY_TO_SHIP' } }),
            prisma.orderItem.count({ where: { ...countWhere, status: 'SHIPPED' } }),
            prisma.orderItem.count({ where: { ...countWhere, status: 'CANCELLED' } }),
        ]);

    // Convert Decimals
    const mapped = items.map((item) => ({
        ...item,
        price:            Number(item.price),
        mrp:              Number(item.mrp),
        gstAmount:        Number(item.gstAmount),
        tcsAmount:        Number(item.tcsAmount),
        tdsAmount:        Number(item.tdsAmount),
        commissionRate:   Number(item.commissionRate),
        commissionAmount: Number(item.commissionAmount),
        order: {
            ...item.order,
            grandTotal: Number(item.order.grandTotal),
        },
    }));

    return {
        orders: mapped,
        pagination: {
            page:       parseInt(page),
            limit:      take,
            total,
            totalPages: Math.ceil(total / take),
        },
        counts: {
            on_hold:       onHoldCount,
            pending:       pendingCount,
            ready_to_ship: readyToShipCount,
            shipped:       shippedCount,
            cancelled:     cancelledCount,
        },
    };
};

module.exports = { getSellerOrders };
