import {
  SettingsTestimonialNotFoundError,
  SettingsValidationError,
} from "../../domain/errors/settings.errors.js";
import { ReactToTestimonialDto } from "../dto/react-to-testimonial.dto.js";

const ALLOWED_REACTIONS = ["like", "dislike"];

export class ReactToTestimonialUseCase {
  constructor({ settingsTestimonialRepository }) {
    this.settingsTestimonialRepository = settingsTestimonialRepository;
  }

  async execute(input) {
    const dto = input instanceof ReactToTestimonialDto
      ? input
      : new ReactToTestimonialDto(input);

    if (!ALLOWED_REACTIONS.includes(dto.reaction)) {
      throw new SettingsValidationError("Invalid reaction type");
    }

    const testimonial = await this.settingsTestimonialRepository.findTestimonialReactionState(dto.testimonialId);

    if (!testimonial) {
      throw new SettingsTestimonialNotFoundError();
    }

    const reactions = [...(testimonial.reactions || [])];
    const existingReactionIndex = reactions.findIndex(
      (item) => item.userId?.toString() === dto.userId.toString(),
    );

    let userReactionStatus = null;
    let likesChange = 0;
    let dislikesChange = 0;

    if (existingReactionIndex >= 0) {
      const existingReactionType = reactions[existingReactionIndex].reaction;

      if (existingReactionType === dto.reaction) {
        reactions.splice(existingReactionIndex, 1);

        if (dto.reaction === "like") {
          likesChange = -1;
        } else {
          dislikesChange = -1;
        }

        userReactionStatus = null;
      } else {
        reactions[existingReactionIndex] = {
          ...reactions[existingReactionIndex],
          reaction: dto.reaction,
        };

        if (existingReactionType === "like") {
          likesChange = -1;
          dislikesChange = 1;
        } else {
          likesChange = 1;
          dislikesChange = -1;
        }

        userReactionStatus = dto.reaction;
      }
    } else {
      reactions.push({
        userId: dto.userId,
        reaction: dto.reaction,
        createdAt: new Date(),
      });

      if (dto.reaction === "like") {
        likesChange = 1;
      } else {
        dislikesChange = 1;
      }

      userReactionStatus = dto.reaction;
    }

    const likes = testimonial.likes + likesChange;
    const dislikes = testimonial.dislikes + dislikesChange;

    await this.settingsTestimonialRepository.saveTestimonialReactionState({
      testimonialId: dto.testimonialId,
      reactions,
      likes,
      dislikes,
    });

    if (userReactionStatus === null) {
      await this.settingsTestimonialRepository.removeUserTestimonialReaction({
        userId: dto.userId,
        testimonialId: dto.testimonialId,
      });
    } else {
      const updateResult = await this.settingsTestimonialRepository.updateUserTestimonialReaction({
        userId: dto.userId,
        testimonialId: dto.testimonialId,
        reaction: userReactionStatus,
      });

      if (updateResult.modifiedCount === 0) {
        await this.settingsTestimonialRepository.addUserTestimonialReaction({
          userId: dto.userId,
          testimonialId: dto.testimonialId,
          reaction: userReactionStatus,
          createdAt: new Date(),
        });
      }
    }

    return {
      success: true,
      message: "Reaction updated successfully",
      likes,
      dislikes,
      userReaction: userReactionStatus,
    };
  }
}
