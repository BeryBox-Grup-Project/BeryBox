const { db, cleanDb, createUser, createItem } = require('./utils');

describe('model hooks and validations', () => {
  beforeEach(cleanDb);
  afterAll(() => db.sequelize.close());

  test('rehashes password on update and stores notification types', async () => {
    const user = await createUser();
    const before = (await db.User.scope('withPassword').findByPk(user.id)).password;
    await user.update({ password: 'NewPassword123!' });
    const after = (await db.User.scope('withPassword').findByPk(user.id)).password;
    expect(after).not.toBe(before);
    expect(after).not.toBe('NewPassword123!');

    const item = await createItem(user.id, { wantedTitle: 'Lensa', wantedCategory: 'electronics' });
    expect(item.wantedTitle).toBe('Lensa');
    const note = await db.Notification.create({
      userId: user.id, type: 'banned', message: 'Your account was banned',
    });
    expect(note.readAt).toBeNull();
    const shipment = await db.Shipment.create({
      requestId: (await db.Request.create({
        type: 'claim', fromUserId: user.id, toUserId: user.id, itemId: item.id, status: 'accepted',
      })).id,
      method: 'pickup',
      payer: 'from_user',
      paymentStatus: 'not_required',
      trackingStatus: 'ready_for_pickup',
      grossAmount: 0,
    });
    expect(shipment.method).toBe('pickup');
  });
});
