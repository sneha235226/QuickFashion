const orderService = require('../../services/seller/order.service');
const response = require('../../utils/response');
const { getSignUrl } = require('../../utils/s3');

/**
 * GET /api/seller/orders
 * Get all orders for this seller's products with full filtering.
 *
 * Query params:
 *   tab              : on_hold | pending | ready_to_ship | shipped | cancelled
 *   slaStatus        : breached | breaching_soon | others
 *   labelDownloaded  : true | false
 *   dispatchPreset   : today | tomorrow | next_3_days
 *   dispatchStart    : ISO date string (custom range start)
 *   dispatchEnd      : ISO date string (custom range end)
 *   orderStart       : ISO date string
 *   orderEnd         : ISO date string
 *   skuId            : search by SKU
 *   sortBy           : sku_id | delivery_partner | dispatch_date
 *   page             : page number
 *   limit            : items per page
 */
const getOrders = async (req, res, next) => {
    try {
        const filters = {
            tab:             req.query.tab,
            slaStatus:       req.query.slaStatus,
            labelDownloaded: req.query.labelDownloaded,
            dispatchPreset:  req.query.dispatchPreset,
            dispatchStart:   req.query.dispatchStart,
            dispatchEnd:     req.query.dispatchEnd,
            orderStart:      req.query.orderStart,
            orderEnd:        req.query.orderEnd,
            skuId:           req.query.skuId,
            sortBy:          req.query.sortBy,
            page:            req.query.page,
            limit:           req.query.limit,
        };

        const result = await orderService.getSellerOrders(req.seller.id, filters);

        // Sign product image URLs
        for (const item of result.orders) {
            if (item.product?.images?.length > 0) {
                for (const img of item.product.images) {
                    if (img.url) img.url = await getSignUrl(img.url);
                }
            }
        }

        return response.success(res, `${result.pagination.total} order item(s) found.`, result);
    } catch (err) {
        next(err);
    }
};

module.exports = { getOrders };
