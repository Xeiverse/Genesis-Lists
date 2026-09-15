package com.genesislists.android.data.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "lists")
data class ListEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: String,
    val updatedAt: String,
    val itemCount: Int,
    val isOwner: Boolean,
    val ownerUsername: String,
    val previewJson: String,
)

@Entity(tableName = "items")
data class ItemEntity(
    @PrimaryKey val id: String,
    val listId: String,
    val text: String,
    val checked: Boolean,
    val position: Int,
    val createdAt: String,
    val updatedAt: String,
)

@Dao
interface CacheDao {
    @Query("SELECT * FROM lists ORDER BY updatedAt DESC")
    fun observeLists(): Flow<List<ListEntity>>

    @Query("SELECT * FROM lists ORDER BY updatedAt DESC")
    suspend fun getLists(): List<ListEntity>

    @Query("SELECT * FROM lists WHERE id = :id LIMIT 1")
    fun observeList(id: String): Flow<ListEntity?>

    @Query("SELECT * FROM lists WHERE id = :id LIMIT 1")
    suspend fun getList(id: String): ListEntity?

    @Query("SELECT * FROM items WHERE listId = :listId ORDER BY position ASC")
    fun observeItems(listId: String): Flow<List<ItemEntity>>

    @Query("SELECT * FROM items WHERE listId = :listId ORDER BY position ASC")
    suspend fun getItems(listId: String): List<ItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLists(lists: List<ListEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItems(items: List<ItemEntity>)

    @Query("DELETE FROM lists WHERE id NOT IN (:ids)")
    suspend fun deleteListsNotIn(ids: List<String>)

    @Query("DELETE FROM lists")
    suspend fun clearLists()

    @Query("DELETE FROM items WHERE listId = :listId")
    suspend fun deleteItemsForList(listId: String)

    @Query("DELETE FROM items WHERE listId = :listId AND id NOT IN (:ids)")
    suspend fun deleteItemsNotIn(listId: String, ids: List<String>)

    @Query("DELETE FROM lists WHERE id = :id")
    suspend fun deleteList(id: String)

    @Query("DELETE FROM items WHERE listId = :listId")
    suspend fun deleteListItems(listId: String)

    @Query("DELETE FROM items")
    suspend fun clearItems()

    @Transaction
    suspend fun replaceAllLists(lists: List<ListEntity>) {
        if (lists.isEmpty()) {
            clearLists()
            clearItems()
        } else {
            upsertLists(lists)
            deleteListsNotIn(lists.map { it.id })
        }
    }

    @Transaction
    suspend fun replaceItemsForList(listId: String, items: List<ItemEntity>) {
        if (items.isEmpty()) {
            deleteItemsForList(listId)
        } else {
            upsertItems(items)
            deleteItemsNotIn(listId, items.map { it.id })
        }
    }

    @Transaction
    suspend fun clearAll() {
        clearItems()
        clearLists()
    }
}

@Database(entities = [ListEntity::class, ItemEntity::class], version = 1, exportSchema = false)
abstract class GenesisDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao
}
