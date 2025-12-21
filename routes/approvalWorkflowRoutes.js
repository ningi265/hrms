import express from 'express';
import {
  createWorkflow,
  getWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  cloneWorkflow,
  publishWorkflow,
  getApplicableWorkflow,
  testWorkflow,
  getWorkflowStatistics,
  getWorkflowTemplates
} from '../controllers/approvalWorkflowController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Route definitions
router.route('/')
  .post(authorize('admin', 'manager', 'procurement_manager'), createWorkflow)
  .get(authorize('admin', 'manager', 'procurement_manager', 'department_head'), getWorkflows);

router.route('/templates')
  .get(authorize('admin', 'manager', 'procurement_manager'), getWorkflowTemplates);

router.route('/applicable')
  .get(authorize('admin', 'manager', 'procurement_manager', 'employee'), getApplicableWorkflow);

router.route('/:id')
  .get(authorize('admin', 'manager', 'procurement_manager', 'department_head'), getWorkflow)
  .put(authorize('admin', 'manager', 'procurement_manager'), updateWorkflow)
  .delete(authorize('admin', 'manager'), deleteWorkflow);

router.route('/:id/clone')
  .post(authorize('admin', 'manager', 'procurement_manager'), cloneWorkflow);

router.route('/:id/publish')
  .post(authorize('admin', 'manager', 'procurement_manager'), publishWorkflow);

router.route('/:id/test')
  .post(authorize('admin', 'manager', 'procurement_manager'), testWorkflow);

router.route('/:id/statistics')
  .get(authorize('admin', 'manager', 'procurement_manager'), getWorkflowStatistics);

export default router;