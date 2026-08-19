import { Router } from 'express';
import * as themePackageController from '@/controllers/theme_package_controller';

const router = Router();

router.get('/', themePackageController.list);
router.get('/:id', themePackageController.getById);

export default router;
