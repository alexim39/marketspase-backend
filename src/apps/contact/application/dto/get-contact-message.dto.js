export class GetContactMessageDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new GetContactMessageDto({
      id: params?.id,
    });
  }
}
