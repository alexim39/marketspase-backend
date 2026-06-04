export class ContactRepository {
  async create() {
    throw new Error("ContactRepository.create must be implemented.");
  }

  async countByFilter() {
    throw new Error("ContactRepository.countByFilter must be implemented.");
  }

  async findMessages() {
    throw new Error("ContactRepository.findMessages must be implemented.");
  }

  async findExportContacts() {
    throw new Error("ContactRepository.findExportContacts must be implemented.");
  }

  async findByIdWithAdminDetails() {
    throw new Error("ContactRepository.findByIdWithAdminDetails must be implemented.");
  }

  async findByIdWithWorkflowDetails() {
    throw new Error("ContactRepository.findByIdWithWorkflowDetails must be implemented.");
  }

  async findById() {
    throw new Error("ContactRepository.findById must be implemented.");
  }

  async markAsReadById() {
    throw new Error("ContactRepository.markAsReadById must be implemented.");
  }

  async setArchiveStatusById() {
    throw new Error("ContactRepository.setArchiveStatusById must be implemented.");
  }

  async setFollowUpDateById() {
    throw new Error("ContactRepository.setFollowUpDateById must be implemented.");
  }

  async setPriorityById() {
    throw new Error("ContactRepository.setPriorityById must be implemented.");
  }

  async setStatusById() {
    throw new Error("ContactRepository.setStatusById must be implemented.");
  }

  async bulkSetStatusByIds() {
    throw new Error("ContactRepository.bulkSetStatusByIds must be implemented.");
  }

  async assignToAdminById() {
    throw new Error("ContactRepository.assignToAdminById must be implemented.");
  }

  async setTagsById() {
    throw new Error("ContactRepository.setTagsById must be implemented.");
  }

  async deleteById() {
    throw new Error("ContactRepository.deleteById must be implemented.");
  }

  async addAdminNote() {
    throw new Error("ContactRepository.addAdminNote must be implemented.");
  }

  async getStats() {
    throw new Error("ContactRepository.getStats must be implemented.");
  }

  async getStatusStats() {
    throw new Error("ContactRepository.getStatusStats must be implemented.");
  }

  async countOpenTickets() {
    throw new Error("ContactRepository.countOpenTickets must be implemented.");
  }

  async countHighPriorityTickets() {
    throw new Error("ContactRepository.countHighPriorityTickets must be implemented.");
  }
}
