import { rolePageAssignmentRepository, userPageAssignmentRepository } from "./page-assignment.repository.js";

export interface PageAssignmentResult {
  pages: string[] | null;
  source: "user" | "role" | "none";
}

export class PageAssignmentService {
  async getRolePages(roleId: string): Promise<string[]> {
    const assignment = await rolePageAssignmentRepository.getByRoleId(roleId);
    return assignment?.pages ?? [];
  }

  async setRolePages(roleId: string, pages: string[]): Promise<void> {
    if (pages.length === 0) {
      await rolePageAssignmentRepository.deleteByRoleId(roleId);
    } else {
      await rolePageAssignmentRepository.upsert(roleId, pages);
    }
  }

  async getAllRoleAssignments(): Promise<Array<{ roleId: string; pages: string[] }>> {
    const all = await rolePageAssignmentRepository.findAll();
    return all.map((a) => ({ roleId: a.roleId, pages: a.pages }));
  }

  async getUserPages(userId: string): Promise<string[]> {
    const assignment = await userPageAssignmentRepository.getByUserId(userId);
    return assignment?.pages ?? [];
  }

  async setUserPages(userId: string, pages: string[]): Promise<void> {
    if (pages.length === 0) {
      await userPageAssignmentRepository.deleteByUserId(userId);
    } else {
      await userPageAssignmentRepository.upsert(userId, pages);
    }
  }

  async getAllUserAssignments(): Promise<Array<{ userId: string; pages: string[] }>> {
    const all = await userPageAssignmentRepository.findAll();
    return all.map((a) => ({ userId: a.userId, pages: a.pages }));
  }

  async getEffectivePages(userId: string, roleId: string): Promise<PageAssignmentResult> {
    const userPages = await this.getUserPages(userId);
    if (userPages.length > 0) {
      return { pages: userPages, source: "user" };
    }

    const rolePages = await this.getRolePages(roleId);
    if (rolePages.length > 0) {
      return { pages: rolePages, source: "role" };
    }

    return { pages: null, source: "none" };
  }
}

export const pageAssignmentService = new PageAssignmentService();
