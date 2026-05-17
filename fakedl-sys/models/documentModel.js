const DLDocument = require('./Document');

// ════════════════════════════════════════════════════════════════
// DOCUMENT MODEL — Mongoose adapter
// All methods are async (Mongoose-based)
// ════════════════════════════════════════════════════════════════

const documentModel = {
  async create(data) {
    const doc = await DLDocument.create({
      dlId: data.dl_id,
      gpsPhoto: data.gps_photo || null,
      supportingDoc: data.supporting_doc || null,
      gpsPhotoHash: data.gps_photo_hash || null,
      supportingDocHash: data.supporting_doc_hash || null,
      photoLat: data.photo_lat || null,
      photoLng: data.photo_lng || null
    });
    console.log(`💾 [DOC] Saved document for DL-${data.dl_id} to MongoDB`);
    return doc._id;
  },

  async findByDlId(dlId) {
    const doc = await DLDocument.findOne({ dlId }).lean();
    if (!doc) return null;
    return {
      doc_id: doc._id,
      dl_id: doc.dlId,
      gps_photo: doc.gpsPhoto,
      supporting_doc: doc.supportingDoc,
      gps_photo_hash: doc.gpsPhotoHash,
      supporting_doc_hash: doc.supportingDocHash,
      photo_lat: doc.photoLat,
      photo_lng: doc.photoLng
    };
  },

  async findByHash(hash) {
    const docs = await DLDocument.find({
      $or: [
        { gpsPhotoHash: hash },
        { supportingDocHash: hash }
      ]
    }).lean();
    return docs.map(d => ({
      doc_id: d._id,
      dl_id: d.dlId,
      gps_photo: d.gpsPhoto,
      supporting_doc: d.supportingDoc,
      gps_photo_hash: d.gpsPhotoHash,
      supporting_doc_hash: d.supportingDocHash
    }));
  }
};

module.exports = documentModel;
