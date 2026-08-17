import { mock } from 'jest-mock-extended';
import { CategoriesService } from '../categories.service';
import { CATEGORY_COLORS } from '../category-colors';
import { Category } from '../domain/category';
import { CreateCategoryCommand } from './create-category.command';
import { FindOrCreateCategoriesCommand } from './find-or-create-categories.command';

describe('FindOrCreateCategoriesCommand', () => {
  const categoriesService = mock<CategoriesService>();
  const createCategoryCommand = mock<CreateCategoryCommand>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildCommand() {
    return new FindOrCreateCategoriesCommand(
      categoriesService,
      createCategoryCommand,
    );
  }

  function buildCategory(overrides: Partial<Category> = {}): Category {
    return {
      id: 'category-1',
      name: 'tech',
      color: CATEGORY_COLORS.blue,
      createdAt: new Date('2026-08-16T12:00:00.000Z'),
      updatedAt: new Date('2026-08-16T12:00:00.000Z'),
      ...overrides,
    };
  }

  it('returns existing categories without creating them', async () => {
    const tech = buildCategory();
    categoriesService.getCategoryByName.mockResolvedValue(tech);

    const command = buildCommand();
    const result = await command.execute(['tech']);

    expect(result).toEqual([tech]);
    expect(createCategoryCommand.execute).not.toHaveBeenCalled();
  });

  it('creates a category when its name does not already exist', async () => {
    const gaming = buildCategory({ id: 'category-2', name: 'gaming' });
    categoriesService.getCategoryByName.mockResolvedValue(null);
    createCategoryCommand.execute.mockResolvedValue(gaming);

    const command = buildCommand();
    const result = await command.execute(['gaming']);

    expect(createCategoryCommand.execute).toHaveBeenCalledWith('gaming');
    expect(result).toEqual([gaming]);
  });

  it('dedupes names case-insensitively, keeping the first-seen casing', async () => {
    const tech = buildCategory();
    categoriesService.getCategoryByName.mockResolvedValue(tech);

    const command = buildCommand();
    await command.execute(['tech', 'Tech', ' TECH ']);

    expect(categoriesService.getCategoryByName).toHaveBeenCalledTimes(1);
    expect(categoriesService.getCategoryByName).toHaveBeenCalledWith('tech');
  });

  it('trims whitespace and drops empty names', async () => {
    const tech = buildCategory();
    categoriesService.getCategoryByName.mockResolvedValue(tech);

    const command = buildCommand();
    await command.execute(['  tech  ', '', '   ']);

    expect(categoriesService.getCategoryByName).toHaveBeenCalledTimes(1);
    expect(categoriesService.getCategoryByName).toHaveBeenCalledWith('tech');
  });

  it('preserves the submitted order and resolves each name independently', async () => {
    const tech = buildCategory({ id: 'category-1', name: 'tech' });
    const ai = buildCategory({
      id: 'category-2',
      name: 'AI',
      color: CATEGORY_COLORS.violet,
    });
    categoriesService.getCategoryByName.mockImplementation((name) =>
      Promise.resolve(name.toLowerCase() === 'tech' ? tech : null),
    );
    createCategoryCommand.execute.mockResolvedValue(ai);

    const command = buildCommand();
    const result = await command.execute(['tech', 'AI']);

    expect(result).toEqual([tech, ai]);
  });
});
