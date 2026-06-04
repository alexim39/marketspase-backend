export class SyncTutorialPlaylistDto {
  constructor({ body = {}, sectionId, playlistId } = {}) {
    this.sectionId = body.sectionId ?? sectionId;
    this.playlistId = body.playlistId ?? playlistId;
  }

  static fromRequest({ body }) {
    return new SyncTutorialPlaylistDto({ body });
  }
}
