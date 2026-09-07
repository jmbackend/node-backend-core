class BaseService {

    constructor(repository) {

        this.repository = repository;

    }

    async findAll(options = {}) {

        return this.repository.findAll(options);

    }

    async findById(id, options = {}) {

        return this.repository.findById(id, options);

    }

    async findOne(where = {}, options = {}) {

        return this.repository.findOne(where, options);

    }

    async create(data) {

        await this.beforeCreate(data);

        const entity =
            await this.repository.create(data);

        await this.afterCreate(entity);

        return entity;

    }

    async update(id, data) {

        await this.beforeUpdate(id, data);

        const entity =
            await this.repository.update(id, data);

        await this.afterUpdate(entity);

        return entity;

    }

    async delete(id) {

        await this.beforeDelete(id);

        const deleted =
            await this.repository.delete(id);

        await this.afterDelete(id);

        return deleted;

    }

    async paginate(options = {}) {

        return this.repository.paginate(options);

    }

    async count(where = {}) {

        return this.repository.count(where);

    }

    async exists(where = {}) {

        return this.repository.exists(where);

    }

    async beforeCreate() { }

    async afterCreate() { }

    async beforeUpdate() { }

    async afterUpdate() { }

    async beforeDelete() { }

    async afterDelete() { }

}

module.exports = BaseService;