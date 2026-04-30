const adminSellerService = require('../../services/admin/seller.service');
const response = require('../../utils/response');

/**
 * GET /api/admin/sellers/pending
 * All sellers who completed onboarding and are awaiting admin review.
 */
const listPending = async (req, res, next) => {
  try {
    const sellers = await adminSellerService.listPendingSellers();
    return response.success(res, `${sellers.length} seller(s) pending approval.`, { sellers });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/sellers
 * All sellers in the system.
 */
const listAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    const sellers = await adminSellerService.listAllSellers(status);
    return response.success(res, `Retrieved ${sellers.length} seller(s).`, { sellers });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/sellers/:id
 * Full detail view for a single seller.
 */
const getDetail = async (req, res, next) => {
  try {
    const seller = await adminSellerService.getSellerDetail(parseInt(req.params.id, 10));
    return response.success(res, 'Seller details retrieved.', { seller });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/sellers/:id/approve
 */
const approve = async (req, res, next) => {
  try {
    const result = await adminSellerService.approveSeller(parseInt(req.params.id, 10));
    return response.success(res, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/sellers/:id/reject
 * Body: { reason }
 */
const reject = async (req, res, next) => {
  try {
    const result = await adminSellerService.rejectSeller(
      parseInt(req.params.id, 10),
      req.body.reason
    );
    return response.success(res, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/sellers/:id/suspend
 * Body: { reason }
 */
const suspend = async (req, res, next) => {
  try {
    const result = await adminSellerService.suspendSeller(
      parseInt(req.params.id, 10),
      req.body.reason
    );
    return response.success(res, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/sellers/:id/reapprove
 */
const reApprove = async (req, res, next) => {
  try {
    const result = await adminSellerService.reApproveSeller(parseInt(req.params.id, 10));
    return response.success(res, result.message);
  } catch (err) {
    next(err);
  }
};

module.exports = { listPending, listAll, getDetail, approve, reject, suspend, reApprove };
