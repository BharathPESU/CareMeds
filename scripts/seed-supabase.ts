import { getDb, isPostgresConfigured, getPool } from '../db/client';
import {
  alertActions,
  alerts,
  alertTypes,
  allergies,
  auditLog,
  beds,
  careAssignments,
  dosageSchedules,
  doseEvents,
  doseEventStatusLog,
  doseTimeWindows,
  emergencyIncidents,
  facility,
  fridgeTemperatureLogs,
  incidentLogEntries,
  inventoryItems,
  medicineCatalogue,
  notifications,
  permissions,
  prescriptions,
  purchaseOrderLines,
  purchaseOrders,
  residentContacts,
  residentDiagnoses,
  residentDocuments,
  residentHistory,
  residentNotes,
  residents,
  rolePermissions,
  roles,
  rooms,
  scheduleTimes,
  shiftHandoverNotes,
  stockMovements,
  storageLocations,
  suppliers,
  systemSettings,
  users,
  vitalReadings,
  vitalTypes,
} from '../db/schema';
import { ROLE_PERMISSION_CODES, ALL_PERMISSIONS } from '../lib/permissions/permissions';
import { createInitialPreviewStore } from '../lib/store/seed-data';
import { eq } from 'drizzle-orm';

export async function seedAllData() {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL is not configured for Supabase Postgres.');
  }

  const db = getDb();
  const store = createInitialPreviewStore();

  console.log('Seeding baseline roles and permissions...');
  // 1. Roles
  for (const name of ['Admin', 'Caretaker', 'Doctor'] as const) {
    await db.insert(roles).values({ name }).onConflictDoNothing();
  }
  const allRoles = await db.select().from(roles);
  const roleMap = new Map(allRoles.map((r) => [r.name, r.roleId]));

  // 2. Permissions
  for (const p of ALL_PERMISSIONS) {
    await db.insert(permissions).values(p).onConflictDoNothing();
  }
  const allPerms = await db.select().from(permissions);
  const permMap = new Map(allPerms.map((p) => [p.code, p.permissionId]));

  // 3. Role Permissions matrix
  for (const [roleName, codes] of Object.entries(ROLE_PERMISSION_CODES)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;
    for (const code of codes) {
      const permissionId = permMap.get(code);
      if (!permissionId) continue;
      await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
    }
  }

  // 4. Alert Types
  for (const at of [
    { code: 'LOW_STOCK', defaultPriority: 'High' },
    { code: 'EXPIRY', defaultPriority: 'Medium' },
    { code: 'MISSED_DOSE', defaultPriority: 'High' },
    { code: 'OVERDUE_DOSE', defaultPriority: 'High' },
    { code: 'ABNORMAL_VITAL', defaultPriority: 'High' },
    { code: 'PRESCRIPTION_ENDING', defaultPriority: 'Medium' },
  ] as const) {
    await db.insert(alertTypes).values({ ...at }).onConflictDoNothing();
  }
  const allAlertTypes = await db.select().from(alertTypes);
  const alertTypeMap = new Map(allAlertTypes.map((a) => [a.code, a.alertTypeId]));

  // 5. Vital Types
  for (const vt of store.vitalTypes) {
    await db
      .insert(vitalTypes)
      .values({
        vitalTypeId: vt.vitalTypeId,
        code: vt.code,
        name: vt.name,
        unit: vt.unit,
        minNormal: vt.minNormal ? String(vt.minNormal) : null,
        maxNormal: vt.maxNormal ? String(vt.maxNormal) : null,
      })
      .onConflictDoNothing();
  }

  // 6. Dose Time Windows
  for (const win of store.doseTimeWindows) {
    await db
      .insert(doseTimeWindows)
      .values({
        windowId: win.windowId,
        name: win.name,
        startTime: win.startTime.length === 5 ? win.startTime + ':00' : win.startTime,
        endTime: win.endTime.length === 5 ? win.endTime + ':00' : win.endTime,
      })
      .onConflictDoNothing();
  }

  // 7. System Settings
  for (const [settingKey, settingValue] of Object.entries(store.systemSettings)) {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, settingKey));
    if (existing.length === 0) {
      await db.insert(systemSettings).values({ settingKey, settingValue });
    } else {
      await db
        .update(systemSettings)
        .set({ settingValue })
        .where(eq(systemSettings.settingKey, settingKey));
    }
  }

  // 8. Facility
  console.log('Seeding facility...');
  await db
    .insert(facility)
    .values({
      facilityId: store.facility.facilityId,
      name: store.facility.name,
      address: store.facility.address,
      phone: store.facility.phone,
      email: store.facility.email,
      registrationNo: store.facility.registrationNo,
    })
    .onConflictDoNothing();

  // 9. Users
  console.log('Seeding users...');
  for (const u of store.users) {
    const roleId = roleMap.get(u.role);
    if (!roleId) continue;
    await db
      .insert(users)
      .values({
        userId: u.userId,
        fullName: u.fullName,
        username: u.username,
        email: u.email,
        phone: u.phone,
        roleId,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        tempPasswordExpiresAt: u.tempPasswordExpiresAt ? new Date(u.tempPasswordExpiresAt) : null,
        passwordChangedAt: u.passwordChangedAt ? new Date(u.passwordChangedAt) : null,
        failedLoginCount: u.failedLoginCount,
        isLocked: u.isLocked,
        lockedAt: u.lockedAt ? new Date(u.lockedAt) : null,
        mfaEnabled: u.mfaEnabled,
        mfaSecretEncrypted: u.mfaSecretEncrypted,
        mfaEnrolledAt: u.mfaEnrolledAt ? new Date(u.mfaEnrolledAt) : null,
        createdBy: u.createdBy,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          username: u.username,
          fullName: u.fullName,
          email: u.email,
          roleId,
          passwordHash: u.passwordHash,
          mfaEnabled: u.mfaEnabled,
          mfaSecretEncrypted: u.mfaSecretEncrypted,
          mfaEnrolledAt: u.mfaEnrolledAt ? new Date(u.mfaEnrolledAt) : null,
          mustChangePassword: u.mustChangePassword,
          isActive: u.isActive,
          isLocked: u.isLocked,
          failedLoginCount: u.failedLoginCount,
          updatedAt: new Date(u.updatedAt),
        },
      });
  }

  // Ensure only one admin account exists in Supabase
  const adminRoleId = roleMap.get('Admin');
  if (adminRoleId) {
    const allAdmins = await db.select().from(users).where(eq(users.roleId, adminRoleId));
    for (const adm of allAdmins) {
      if (adm.userId !== '10000000-0000-4000-8000-000000000001') {
        try {
          await db.update(purchaseOrders).set({ createdBy: '10000000-0000-4000-8000-000000000001' }).where(eq(purchaseOrders.createdBy, adm.userId));
          await db.delete(users).where(eq(users.userId, adm.userId));
        } catch {
          await db.update(users).set({ isActive: false }).where(eq(users.userId, adm.userId));
        }
      }
    }
  }

  // 10. Rooms & Beds
  console.log('Seeding rooms and beds...');
  for (const r of store.rooms) {
    await db.insert(rooms).values({
      roomId: r.roomId,
      roomCode: r.roomCode,
      wingOrFloor: r.wingOrFloor,
    }).onConflictDoNothing();
  }

  for (const b of store.beds) {
    await db.insert(beds).values({
      bedId: b.bedId,
      roomId: b.roomId,
      bedCode: b.bedCode,
    }).onConflictDoNothing();
  }

  // 11. Residents
  console.log('Seeding residents...');
  for (const res of store.residents) {
    await db.insert(residents).values({
      residentId: res.residentId,
      fullName: res.fullName,
      photoPath: res.photoPath,
      dateOfBirth: res.dateOfBirth,
      gender: res.gender,
      bloodGroup: res.bloodGroup,
      bedId: res.bedId,
      admissionDate: res.admissionDate,
      dietNotes: res.dietNotes,
      assignedDoctorId: res.assignedDoctorId,
      status: res.status,
      archivedAt: res.archivedAt ? new Date(res.archivedAt) : null,
      archiveReason: res.archiveReason,
      allergyStatus: res.allergyStatus,
      createdBy: res.createdBy,
      createdAt: new Date(res.createdAt),
      updatedAt: new Date(res.updatedAt),
    }).onConflictDoNothing();
  }

  // 12. Care Assignments
  console.log('Seeding care assignments...');
  for (const ca of store.careAssignments) {
    await db.insert(careAssignments).values({
      assignmentId: ca.assignmentId,
      caretakerId: ca.caretakerId,
      residentId: ca.residentId,
      assignedBy: ca.assignedBy,
      assignedAt: new Date(ca.assignedAt),
      endedAt: ca.endedAt ? new Date(ca.endedAt) : null,
      endedBy: ca.endedBy,
    }).onConflictDoNothing();
  }

  // 13. Resident Contacts
  console.log('Seeding resident contacts...');
  for (const rc of store.residentContacts) {
    await db.insert(residentContacts).values({
      contactId: rc.contactId,
      residentId: rc.residentId,
      fullName: rc.fullName,
      relationship: rc.relationship,
      phone: rc.phone,
      email: rc.email,
      isPrimary: rc.isPrimary,
      receivesNotifications: rc.receivesNotifications,
    }).onConflictDoNothing();
  }

  // 14. Diagnoses & History
  console.log('Seeding diagnoses and history...');
  for (const d of store.residentDiagnoses) {
    await db.insert(residentDiagnoses).values({
      diagnosisId: d.diagnosisId,
      residentId: d.residentId,
      description: d.description,
      diagnosedOn: d.diagnosedOn,
      isActive: d.isActive,
      recordedBy: d.recordedBy,
    }).onConflictDoNothing();
  }

  for (const h of store.residentHistory) {
    await db.insert(residentHistory).values({
      historyId: h.historyId,
      residentId: h.residentId,
      type: h.type,
      description: h.description,
      eventDate: h.eventDate,
      recordedBy: h.recordedBy,
    }).onConflictDoNothing();
  }

  // 15. Storage Locations & Suppliers
  console.log('Seeding storage locations and suppliers...');
  for (const loc of store.storageLocations) {
    await db.insert(storageLocations).values({
      locationId: loc.locationId,
      name: loc.name,
      locationType: loc.locationType,
      isLocked: loc.isLocked,
    }).onConflictDoNothing();
  }

  for (const sup of store.suppliers) {
    await db.insert(suppliers).values({
      supplierId: sup.supplierId,
      name: sup.name,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      email: sup.email,
    }).onConflictDoNothing();
  }

  // 16. Medicine Catalogue
  console.log('Seeding medicine catalogue...');
  for (const m of store.medicines) {
    await db.insert(medicineCatalogue).values({
      medicineId: m.medicineId,
      name: m.name,
      genericName: m.genericName,
      form: m.form,
      strength: m.strength,
      stockUnit: m.stockUnit,
      manufacturer: m.manufacturer,
      category: m.category,
      foodInstruction: m.foodInstruction,
      sideEffects: m.sideEffects,
      storageCondition: m.storageCondition,
      isControlled: m.isControlled,
      status: m.status,
      approvalStatus: m.approvalStatus,
      proposedBy: m.proposedBy,
      approvedBy: m.approvedBy,
      createdAt: new Date(m.createdAt),
    }).onConflictDoNothing();
  }

  // 17. Allergies
  console.log('Seeding allergies...');
  for (const a of store.allergies) {
    await db.insert(allergies).values({
      allergyId: a.allergyId,
      residentId: a.residentId,
      medicineId: a.medicineId,
      substanceText: a.substanceText,
      reaction: a.reaction,
      severity: a.severity,
      recordedBy: a.recordedBy,
      recordedAt: new Date(a.recordedAt),
    }).onConflictDoNothing();
  }

  // 18. Resident Notes & Handover Notes
  console.log('Seeding resident notes...');
  for (const n of store.residentNotes) {
    await db.insert(residentNotes).values({
      noteId: n.noteId,
      residentId: n.residentId,
      authorId: n.authorId,
      noteType: n.noteType,
      body: n.body,
      createdAt: new Date(n.createdAt),
    }).onConflictDoNothing();
  }

  for (const sh of store.shiftHandoverNotes) {
    await db.insert(shiftHandoverNotes).values({
      noteId: sh.noteId,
      residentId: sh.residentId,
      windowId: sh.windowId,
      shiftDate: sh.shiftDate,
      authorId: sh.authorId,
      body: sh.body,
      createdAt: new Date(sh.createdAt),
    }).onConflictDoNothing();
  }

  // 19. Resident Documents
  for (const doc of store.residentDocuments) {
    await db.insert(residentDocuments).values({
      documentId: doc.documentId,
      residentId: doc.residentId,
      documentType: doc.documentType,
      storagePath: doc.storagePath,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedBy: doc.uploadedBy,
      uploadedAt: new Date(doc.uploadedAt),
    }).onConflictDoNothing();
  }

  // 20. Fridge Temperature Logs
  for (const fl of store.fridgeTemperatureLogs) {
    await db.insert(fridgeTemperatureLogs).values({
      logId: fl.logId,
      locationId: fl.locationId,
      temperatureC: String(fl.temperatureC),
      recordedAt: new Date(fl.recordedAt),
      recordedBy: fl.recordedBy,
    }).onConflictDoNothing();
  }

  // 21. Inventory Items
  console.log('Seeding inventory items...');
  for (const item of store.inventoryItems) {
    await db.insert(inventoryItems).values({
      stockId: item.stockId,
      medicineId: item.medicineId,
      batchNumber: item.batchNumber,
      supplierId: item.supplierId,
      locationId: item.locationId,
      purchaseDate: item.purchaseDate,
      unitCost: String(item.unitCost),
      expiryDate: item.expiryDate,
      reorderLevel: item.reorderLevel,
    }).onConflictDoNothing();
  }

  // 22. Prescriptions
  console.log('Seeding prescriptions...');
  for (const rx of store.prescriptions) {
    await db.insert(prescriptions).values({
      prescriptionId: rx.prescriptionId,
      residentId: rx.residentId,
      medicineId: rx.medicineId,
      prescribedBy: rx.prescribedBy,
      reasonDiagnosis: rx.reasonDiagnosis,
      specialInstructions: rx.specialInstructions,
      allergyOverrideReason: rx.allergyOverrideReason,
      startDate: rx.startDate,
      endDate: rx.endDate,
      status: rx.status,
      stopReason: rx.stopReason,
      stoppedAt: rx.stoppedAt ? new Date(rx.stoppedAt) : null,
      renewalReminderDays: rx.renewalReminderDays,
      previousPrescriptionId: rx.previousPrescriptionId,
    }).onConflictDoNothing();
  }

  // 23. Dosage Schedules & Schedule Times
  console.log('Seeding dosage schedules and times...');
  for (const sch of store.dosageSchedules) {
    await db.insert(dosageSchedules).values({
      scheduleId: sch.scheduleId,
      prescriptionId: sch.prescriptionId,
      doseAmount: String(sch.doseAmount),
      doseUnit: sch.doseUnit,
      route: sch.route,
      frequency: sch.frequency,
      intervalHours: sch.intervalHours,
      isPrn: sch.isPrn,
      prnMinGapMinutes: sch.prnMinGapMinutes,
      prnMaxPerDay: sch.prnMaxPerDay,
      effectiveFrom: sch.effectiveFrom,
      effectiveTo: sch.effectiveTo,
      changedBy: sch.changedBy,
      changeReason: sch.changeReason,
    }).onConflictDoNothing();

    if (sch.times && Array.isArray(sch.times)) {
      for (const t of sch.times) {
        await db.insert(scheduleTimes).values({
          scheduleTimeId: t.scheduleTimeId,
          scheduleId: sch.scheduleId,
          timeOfDay: t.timeOfDay.length === 5 ? t.timeOfDay + ':00' : t.timeOfDay,
          windowId: t.windowId,
        }).onConflictDoNothing();
      }
    }
  }

  // 24. Dose Events & Status Log
  console.log('Seeding dose events...');
  for (const de of store.doseEvents) {
    await db.insert(doseEvents).values({
      doseEventId: de.doseEventId,
      scheduleId: de.scheduleId,
      scheduledAt: new Date(de.scheduledAt),
      status: de.status,
      administeredAt: de.administeredAt ? new Date(de.administeredAt) : null,
      confirmedBy: de.confirmedBy,
      reason: de.reason,
      isManual: de.isManual,
      createdBy: de.createdBy,
      undoUntil: de.undoUntil ? new Date(de.undoUntil) : null,
    }).onConflictDoNothing();
  }

  for (const dsl of store.doseEventStatusLog) {
    await db.insert(doseEventStatusLog).values({
      logId: dsl.logId,
      doseEventId: dsl.doseEventId,
      fromStatus: dsl.fromStatus,
      toStatus: dsl.toStatus,
      changedBy: dsl.changedBy,
      changedAt: new Date(dsl.changedAt),
      reason: dsl.reason,
    }).onConflictDoNothing();
  }

  // 25. Stock Movements
  console.log('Seeding stock movements...');
  for (const sm of store.stockMovements) {
    await db.insert(stockMovements).values({
      movementId: sm.movementId,
      stockId: sm.stockId,
      movementType: sm.movementType,
      quantityChange: sm.quantityChange,
      reason: sm.reason,
      doseEventId: sm.doseEventId,
      approvalStatus: sm.approvalStatus,
      performedBy: sm.performedBy,
      approvedBy: sm.approvedBy,
      createdAt: new Date(sm.createdAt),
    }).onConflictDoNothing();
  }

  // 26. Purchase Orders
  console.log('Seeding purchase orders...');
  for (const po of store.purchaseOrders) {
    await db.insert(purchaseOrders).values({
      poId: po.poId,
      supplierId: po.supplierId,
      status: po.status,
      createdBy: po.createdBy,
      approvedBy: po.approvedBy,
      createdAt: new Date(po.createdAt),
      approvedAt: po.approvedAt ? new Date(po.approvedAt) : null,
    }).onConflictDoNothing();

    if (po.lines && Array.isArray(po.lines)) {
      for (const line of po.lines) {
        await db.insert(purchaseOrderLines).values({
          lineId: line.lineId,
          poId: po.poId,
          medicineId: line.medicineId,
          quantity: line.quantity,
          unitCost: String(line.unitCost),
        }).onConflictDoNothing();
      }
    }
  }

  // 27. Vital Readings
  console.log('Seeding vital readings...');
  for (const vr of store.vitalReadings) {
    await db.insert(vitalReadings).values({
      readingId: vr.readingId,
      residentId: vr.residentId,
      recordedAt: new Date(vr.recordedAt),
      recordedBy: vr.recordedBy,
      bpSystolic: vr.bpSystolic,
      bpDiastolic: vr.bpDiastolic,
      bloodSugar: vr.bloodSugar ? String(vr.bloodSugar) : null,
      bloodSugarUnit: vr.bloodSugarUnit,
      temperatureC: vr.temperatureC ? String(vr.temperatureC) : null,
      pulseBpm: vr.pulseBpm,
      spo2Percent: vr.spo2Percent,
      weightKg: vr.weightKg ? String(vr.weightKg) : null,
      notes: vr.notes,
    }).onConflictDoNothing();
  }

  // 28. Alerts & Actions
  console.log('Seeding alerts and alert actions...');
  for (const al of store.alerts) {
    const alertTypeId = alertTypeMap.get(al.alertCode);
    if (!alertTypeId) continue;
    await db.insert(alerts).values({
      alertId: al.alertId,
      alertTypeId,
      priority: al.priority,
      status: al.status,
      residentId: al.residentId,
      stockId: al.stockId,
      doseEventId: al.doseEventId,
      readingId: al.readingId,
      prescriptionId: al.prescriptionId,
      message: al.message,
      createdAt: new Date(al.createdAt),
      dueBy: al.dueBy ? new Date(al.dueBy) : null,
      escalatedTo: al.escalatedTo,
    }).onConflictDoNothing();
  }

  for (const aa of store.alertActions) {
    await db.insert(alertActions).values({
      actionId: aa.actionId,
      alertId: aa.alertId,
      userId: aa.userId,
      action: aa.action,
      note: aa.note,
      createdAt: new Date(aa.createdAt),
    }).onConflictDoNothing();
  }

  // 29. Emergency Incidents & Entries
  console.log('Seeding emergency incidents...');
  for (const inc of store.emergencyIncidents) {
    await db.insert(emergencyIncidents).values({
      incidentId: inc.incidentId,
      residentId: inc.residentId,
      reportedBy: inc.reportedBy,
      occurredAt: new Date(inc.occurredAt),
      description: inc.description,
      status: inc.status,
    }).onConflictDoNothing();
  }

  for (const entry of store.incidentLogEntries) {
    await db.insert(incidentLogEntries).values({
      entryId: entry.entryId,
      incidentId: entry.incidentId,
      loggedBy: entry.loggedBy,
      actionTime: new Date(entry.actionTime),
      actionTaken: entry.actionTaken,
      outcome: entry.outcome,
      loggedAt: new Date(entry.loggedAt),
    }).onConflictDoNothing();
  }

  // 30. Notifications
  console.log('Seeding notifications...');
  for (const notif of store.notifications) {
    await db.insert(notifications).values({
      notificationId: notif.notificationId,
      residentContactId: notif.residentContactId,
      userId: notif.userId,
      alertId: notif.alertId,
      incidentId: notif.incidentId,
      channel: notif.channel,
      status: notif.status,
      attempts: notif.attempts,
      lastError: notif.lastError,
      sentAt: notif.sentAt ? new Date(notif.sentAt) : null,
    }).onConflictDoNothing();
  }

  console.log('CareMeds Supabase PostgreSQL full data seed complete!');
}

if (require.main === module) {
  seedAllData()
    .then(() => {
      console.log('Finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
