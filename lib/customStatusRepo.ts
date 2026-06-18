import { prisma } from './prisma';

export interface CustomStatusDTO {
  id: string;
  label: string;
}

export async function listCustomStatuses(): Promise<CustomStatusDTO[]> {
  return prisma.customStatus.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createCustomStatus(label: string): Promise<CustomStatusDTO> {
  return prisma.customStatus.create({ data: { label: label.trim() } });
}

export async function deleteCustomStatus(id: string): Promise<boolean> {
  try {
    await prisma.customStatus.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
