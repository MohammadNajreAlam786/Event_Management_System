/**
 * Temporary endpoints used only to verify RBAC in Phase 1.
 * They will be replaced by real feature APIs in later phases.
 */
const roleTestResponse = (area) => (req, res) => {
  res.status(200).json({
    success: true,
    message: `${area} access granted.`,
    area,
    user: req.user,
  });
};

export const adminTest = roleTestResponse('ADMIN');
export const organiserTest = roleTestResponse('ORGANISER');
export const userTest = roleTestResponse('USER');
