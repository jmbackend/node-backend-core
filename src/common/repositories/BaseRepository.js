class BaseRepository {

    constructor(model) {

        this.model = model;

    }

    async findAll(options = {}) {

        return this.model.findAll(options);

    }

    async findById(id, options = {}) {

        return this.model.findByPk(id, options);

    }

    async findOne(where = {}, options = {}) {

        return this.model.findOne({

            where,

            ...options

        });

    }

    async create(data, options = {}) {

        return this.model.create(data, options);

    }

    async update(id, data, options = {}) {

        const entity = await this.findById(id);

        if (!entity)
            return null;

        return entity.update(data, options);

    }

    async delete(id, options = {}) {

        const entity = await this.findById(id);

        if (!entity)
            return false;

        await entity.destroy(options);

        return true;

    }

    async count(where = {}) {

        return this.model.count({

            where

        });

    }

    async exists(where = {}) {

        const total = await this.count(where);

        return total > 0;

    }

    async paginate({

        page = 1,

        limit = 10,

        where = {},

        order = [["id", "ASC"]],

        include = []

    } = {}) {

        const offset = (page - 1) * limit;

        const {

            rows,

            count

        } = await this.model.findAndCountAll({

            where,

            limit,

            offset,

            order,

            include

        });

        return {

            data: rows,

            pagination: {

                page,

                limit,

                total: count,

                pages: Math.ceil(count / limit)

            }

        };

    }

}

module.exports = BaseRepository;