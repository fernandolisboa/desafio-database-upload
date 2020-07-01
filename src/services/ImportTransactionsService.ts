import csvParse from 'csv-parse';
import fs from 'fs';

import { getRepository, In, getCustomRepository } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface CSVTransaction extends Pick<Transaction, 'title' | 'type' | 'value'> {
  categoryTitle: string;
}

class ImportTransactionsService {
  public async execute(filepath: string): Promise<Transaction[]> {
    const readCSVStream = fs.createReadStream(filepath);

    const parseStream = csvParse({ from_line: 2 });

    const parseCSV = readCSVStream.pipe(parseStream);

    const csvTransactions: CSVTransaction[] = [];
    const csvCategories: string[] = [];

    parseCSV.on('data', line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      csvTransactions.push({ title, type, value, categoryTitle: category });
      csvCategories.push(category);
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categoriesRepository = getRepository(Category);

    const existentCategories = await categoriesRepository.find({
      where: { title: In(csvCategories) },
    });

    const existentCategoriesTitle = existentCategories.map(
      ({ title }) => title,
    );

    const addCategoriesTitles = csvCategories
      .filter(category => !existentCategoriesTitle.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoriesTitles.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const allCategories = [...newCategories, ...existentCategories];

    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const createdTransactions = transactionsRepository.create(
      csvTransactions.map(({ title, type, value, categoryTitle }) => ({
        title,
        type,
        value,
        category: allCategories.find(
          category => category.title === categoryTitle,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filepath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
