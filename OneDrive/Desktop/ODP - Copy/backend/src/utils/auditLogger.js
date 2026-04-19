const AuditLog = require('../models/AuditLog');

const recordAuditLog = async ({
  req,
  action,
  entityType,
  entityId = '',
  entityName = '',
  status = 'success',
  metadata = {}
}) => {
  try {
    await AuditLog.create({
      actorId: req?.user?.id || null,
      actorRole: req?.user?.role || 'system',
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      entityName,
      status,
      metadata,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
      userAgent: req?.get?.('user-agent') || ''
    });
  } catch (error) {
    console.error('Failed to record audit log:', error.message);
  }
};

module.exports = recordAuditLog;