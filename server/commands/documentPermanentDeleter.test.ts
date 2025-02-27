import { subDays } from "date-fns";
import { Attachment, Document } from "@server/models";
import { buildAttachment, buildDocument } from "@server/test/factories";
import { getTestDatabase } from "@server/test/support";
import documentPermanentDeleter from "./documentPermanentDeleter";

const db = getTestDatabase();

afterAll(db.disconnect);

beforeEach(db.flush);

describe("documentPermanentDeleter", () => {
  it("should destroy documents", async () => {
    const document = await buildDocument({
      publishedAt: subDays(new Date(), 90),
      deletedAt: new Date(),
    });
    const countDeletedDoc = await documentPermanentDeleter([document]);
    expect(countDeletedDoc).toEqual(1);
    expect(
      await Document.unscoped().count({
        paranoid: false,
      })
    ).toEqual(0);
  });

  it("should error when trying to destroy undeleted documents", async () => {
    const document = await buildDocument({
      publishedAt: new Date(),
    });
    let error;

    try {
      await documentPermanentDeleter([document]);
    } catch (err) {
      error = err.message;
    }

    expect(error).toEqual(
      `Cannot permanently delete ${document.id} document. Please delete it and try again.`
    );
  });

  it("should destroy attachments no longer referenced", async () => {
    const document = await buildDocument({
      publishedAt: subDays(new Date(), 90),
      deletedAt: new Date(),
    });
    const attachment = await buildAttachment({
      teamId: document.teamId,
      documentId: document.id,
    });
    document.text = `![text](${attachment.redirectUrl})`;
    await document.save();
    const countDeletedDoc = await documentPermanentDeleter([document]);
    expect(countDeletedDoc).toEqual(1);
    expect(await Attachment.count()).toEqual(0);
    expect(
      await Document.unscoped().count({
        paranoid: false,
      })
    ).toEqual(0);
  });

  it("should handle unknown attachment ids", async () => {
    const document = await buildDocument({
      publishedAt: subDays(new Date(), 90),
      deletedAt: new Date(),
    });
    const attachment = await buildAttachment({
      teamId: document.teamId,
      documentId: document.id,
    });
    document.text = `![text](${attachment.redirectUrl})`;
    await document.save();
    // remove attachment so it no longer exists in the database, this is also
    // representative of a corrupt attachment id in the doc or the regex returning
    // an incorrect string
    await attachment.destroy({
      force: true,
    });
    const countDeletedDoc = await documentPermanentDeleter([document]);
    expect(countDeletedDoc).toEqual(1);
    expect(await Attachment.count()).toEqual(0);
    expect(
      await Document.unscoped().count({
        paranoid: false,
      })
    ).toEqual(0);
  });

  it("should not destroy attachments referenced in other documents", async () => {
    const document1 = await buildDocument();
    const document = await buildDocument({
      teamId: document1.teamId,
      publishedAt: subDays(new Date(), 90),
      deletedAt: subDays(new Date(), 60),
    });
    const attachment = await buildAttachment({
      teamId: document1.teamId,
      documentId: document.id,
    });
    document1.text = `![text](${attachment.redirectUrl})`;
    await document1.save();
    document.text = `![text](${attachment.redirectUrl})`;
    await document.save();
    expect(await Attachment.count()).toEqual(1);
    const countDeletedDoc = await documentPermanentDeleter([document]);
    expect(countDeletedDoc).toEqual(1);
    expect(await Attachment.count()).toEqual(1);
    expect(
      await Document.unscoped().count({
        paranoid: false,
      })
    ).toEqual(1);
  });
});
