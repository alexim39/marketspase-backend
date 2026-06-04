export class DeleteContactDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new DeleteContactDto({
      id: params?.id,
    });
  }
}
